import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseService } from './parse.service';
import { ParseResultDto } from './dto/parse-result.dto';
import { Express } from 'express';

@Controller('parse')
export class ParseController {
  constructor(private readonly parseService: ParseService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async parseResume(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ): Promise<ParseResultDto> {
    const fileName = body?.fileName || file?.originalname || 'resume';
    const fileUrl = body?.fileUrl || '';

    if (file && file.buffer) {
      return this.parseService.parseResumeFromBuffer(file.buffer, fileName);
    }

    if (fileUrl) {
      return this.parseService.parseResume(fileUrl, fileName);
    }

    const result = new ParseResultDto();
    result.error = '未提供文件内容或文件URL';
    result.confidence = 0;
    return result;
  }
}
