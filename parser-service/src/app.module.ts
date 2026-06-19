import { Module } from '@nestjs/common';
import { ParseModule } from './parse/parse.module';

@Module({
  imports: [ParseModule],
})
export class AppModule {}
