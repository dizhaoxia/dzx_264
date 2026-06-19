import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ParseService } from './parse.service';
import { ParseRequestDto } from './dto/parse-request.dto';
import { ParseResultDto } from './dto/parse-result.dto';

@Controller('parse')
export class ParseController {
  constructor(private readonly parseService: ParseService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async parseResume(@Body() request: ParseRequestDto): Promise<ParseResultDto> {
    return this.parseService.parseResume(request.fileUrl, request.fileName);
  }
}
