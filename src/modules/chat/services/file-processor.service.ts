import { Injectable, Logger } from '@nestjs/common';
import pdf from 'pdf-parse';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { readFileSync } from 'fs';

export interface ProcessedFile {
  fileName: string;
  mimeType: string;
  size: number;
  content?: string;
  imageData?: Buffer;
  error?: string;
}

@Injectable()
export class FileProcessorService {
  private readonly logger = new Logger(FileProcessorService.name);

  /**
   * Process uploaded file based on type
   */
  async processFile(file: Express.Multer.File): Promise<ProcessedFile> {
    this.logger.log(`Processing file: ${file.originalname} (${file.mimetype})`);

    const result: ProcessedFile = {
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };

    try {
      // Image files - store binary data for OpenAI Vision
      if (file.mimetype.startsWith('image/')) {
        result.imageData = file.buffer;
        this.logger.log(`Image file processed: ${file.originalname}`);
        return result;
      }

      // PDF files
      if (file.mimetype === 'application/pdf') {
        result.content = await this.extractPdfText(file.buffer);
        this.logger.log(`PDF text extracted: ${result.content?.length} characters`);
        return result;
      }

      // Excel/CSV files
      if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'text/csv'
      ) {
        result.content = await this.extractExcelText(file.buffer);
        this.logger.log(`Excel/CSV text extracted: ${result.content?.length} characters`);
        return result;
      }

      // Word documents
      if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'application/msword'
      ) {
        result.content = await this.extractWordText(file.buffer);
        this.logger.log(`Word text extracted: ${result.content?.length} characters`);
        return result;
      }

      // Plain text files
      if (file.mimetype.startsWith('text/')) {
        result.content = file.buffer.toString('utf-8');
        this.logger.log(`Text file read: ${result.content?.length} characters`);
        return result;
      }

      // Unsupported file type
      result.error = 'Unsupported file type';
      this.logger.warn(`Unsupported file type: ${file.mimetype}`);
      return result;

    } catch (error) {
      this.logger.error(`Error processing file: ${error.message}`, error.stack);
      result.error = `Failed to process file: ${error.message}`;
      return result;
    }
  }

  /**
   * Extract text from PDF
   */
  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from Excel/CSV
   */
  private async extractExcelText(buffer: Buffer): Promise<string> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        text += `\n=== Sheet: ${sheetName} ===\n`;
        text += XLSX.utils.sheet_to_csv(worksheet);
        text += '\n';
      });

      return text.trim();
    } catch (error) {
      throw new Error(`Excel extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from Word document
   */
  private async extractWordText(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`Word extraction failed: ${error.message}`);
    }
  }

  /**
   * Get supported file types
   */
  getSupportedTypes(): string[] {
    return [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Documents
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      // Spreadsheets
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      // Text
      'text/plain',
      'text/markdown',
      'text/html',
      'application/json',
      'text/javascript',
      'text/typescript',
      'text/python',
    ];
  }
}
