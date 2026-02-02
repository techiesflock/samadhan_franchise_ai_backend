import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, JwtPayload } from '../../common/interfaces/user.interface';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserEntity } from '../../entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private jwtService: JwtService,
  ) {
    // Create a demo user on startup
    this.createDemoUser();
  }

  private async createDemoUser() {
    try {
      const existingDemo = await this.userRepository.findOne({ where: { email: 'demo@example.com' } });
      if (!existingDemo) {
        const hashedPassword = await bcrypt.hash('demo123', 10);
        const demoUser = this.userRepository.create({
          email: 'demo@example.com',
          username: 'demo',
          password: hashedPassword,
        });
        await this.userRepository.save(demoUser);
        this.logger.log('✅ Demo user created: demo@example.com / demo123');
      } else {
        this.logger.log('ℹ️  Demo user already exists: demo@example.com / demo123');
      }
    } catch (error) {
      this.logger.error('Failed to create demo user:', error.message);
    }
  }

  async register(registerDto: RegisterDto) {
    const { email, password, username } = registerDto;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = this.userRepository.create({
      email,
      username,
      password: hashedPassword,
    });

    await this.userRepository.save(user);

    this.logger.log(`✅ New user registered: ${email}`);

    // Generate token
    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  async validateUserById(userId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  generateToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    return this.jwtService.sign(payload);
  }

  private sanitizeUser(user: User & { password?: string }): User {
    const { password, ...sanitized } = user;
    return sanitized as User;
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.validateUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
