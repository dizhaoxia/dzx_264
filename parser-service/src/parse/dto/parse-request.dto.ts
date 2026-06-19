import { IsString, IsNotEmpty } from 'class-validator';

export class ParseRequestDto {
  @IsString()
  @IsNotEmpty({ message: '文件URL不能为空' })
  fileUrl: string;

  @IsString()
  @IsNotEmpty({ message: '文件名不能为空' })
  fileName: string;
}
