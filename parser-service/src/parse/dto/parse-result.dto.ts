export class ParseResultDto {
  // 原始文本内容
  rawText: string;

  // 提取的结构化信息
  name: string;
  phone: string;
  email: string;
  workYears: number;
  skills: string[];
  education: string;

  // 解析置信度 (0-100)
  confidence: number;

  // 解析方法说明
  parseMethod: string;

  // 错误信息（如果有）
  error?: string;
}
