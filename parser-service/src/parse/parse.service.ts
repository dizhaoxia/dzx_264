import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as pdfParse from 'pdf-parse';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import * as AdmZip from 'adm-zip';
import { ParseResultDto } from './dto/parse-result.dto';

@Injectable()
export class ParseService {
  private readonly logger = new Logger(ParseService.name);

  private readonly skillKeywords = [
    'JavaScript', 'TypeScript', 'Node.js', 'React', 'Vue', 'Angular',
    'Java', 'Spring', 'SpringBoot', 'MyBatis', 'Python', 'Django', 'Flask',
    'Go', 'Golang', 'Rust', 'C++', 'C#', '.NET', 'PHP', 'Laravel',
    'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Oracle', 'SQLServer',
    'Docker', 'Kubernetes', 'K8s', 'Nginx', 'Linux', 'Git',
    'AWS', '阿里云', '腾讯云', '微服务', '分布式', '高并发',
    '机器学习', '深度学习', 'AI', '大语言模型', 'LLM',
    'HTML', 'CSS', 'Sass', 'Less', 'Webpack', 'Vite', 'Rollup',
    'RESTful', 'GraphQL', 'WebSocket', 'TCP/IP', 'HTTP', 'HTTPS',
    'Jest', 'Mocha', 'JUnit', '自动化测试', '单元测试',
    '敏捷开发', 'Scrum', 'DevOps', 'CI/CD', 'Jenkins',
    '产品经理', 'UI设计', 'UX设计', '数据分析', '数据挖掘',
    'Hadoop', 'Spark', 'Flink', 'Hive', 'Kafka', 'RabbitMQ',
    'Elasticsearch', 'Lucene', 'Solr', 'Redis', 'Memcached',
    'Vue.js', 'React.js', 'Next.js', 'Nuxt.js', 'Express', 'Koa',
    'NestJS', 'Midway', 'Egg.js', 'Fastify',
    'Android', 'iOS', 'Flutter', 'React Native', '小程序', '鸿蒙',
    'Unity', 'Unreal', 'Cocos', 'Three.js', 'WebGL'
  ];

  async parseResumeFromBuffer(buffer: Buffer, fileName: string): Promise<ParseResultDto> {
    const result: ParseResultDto = {
      rawText: '',
      name: '',
      phone: '',
      email: '',
      workYears: 0,
      skills: [],
      confidence: 0,
      parseMethod: '',
    };

    try {
      this.logger.log(`开始解析简历（Buffer）: ${fileName}, 大小: ${buffer.length} bytes`);

      const ext = path.extname(fileName).toLowerCase();
      let text = '';

      if (ext === '.pdf') {
        text = await this.parsePdfFromBuffer(buffer);
        result.parseMethod = 'PDF双层解析(pdf-parse + pdfjs-dist)';
      } else if (ext === '.docx') {
        text = await this.parseDocxFromBuffer(buffer);
        result.parseMethod = 'DOCX解析(docx + mammoth)';
      } else if (ext === '.doc') {
        text = await this.parseDocFromBuffer(buffer);
        result.parseMethod = 'DOC解析(mammoth)';
      } else {
        this.logger.warn(`未知文件格式: ${ext}，尝试通用解析`);
        text = buffer.toString('utf-8');
        result.parseMethod = '通用文本解析';
      }

      result.rawText = text;
      this.logger.log(`提取文本长度: ${text.length} 字符`);

      const extracted = this.extractInfo(text, fileName);
      Object.assign(result, extracted);

      result.confidence = this.calculateConfidence(result, text.length);

      try {
        const aiEnhanced = await this.aiEnhanceParse(result, text);
        if (aiEnhanced) {
          Object.assign(result, aiEnhanced);
          result.confidence = Math.min(100, result.confidence + 5);
        }
      } catch (aiError: any) {
        this.logger.warn(`AI增强解析失败，使用基础解析结果: ${aiError.message}`);
      }

      this.logger.log(`解析完成，置信度: ${result.confidence}`);
      return result;
    } catch (error: any) {
      this.logger.error(`解析失败: ${error.message}`);
      result.error = error.message;
      result.confidence = 0;
      return result;
    }
  }

  async parseResume(fileUrl: string, fileName: string): Promise<ParseResultDto> {
    const result: ParseResultDto = {
      rawText: '',
      name: '',
      phone: '',
      email: '',
      workYears: 0,
      skills: [],
      confidence: 0,
      parseMethod: '',
    };

    try {
      this.logger.log(`开始解析简历: ${fileName}`);

      const localFilePath = await this.downloadFile(fileUrl, fileName);
      this.logger.log(`文件已下载到: ${localFilePath}`);

      const ext = path.extname(fileName).toLowerCase();
      let text = '';

      if (ext === '.pdf') {
        text = await this.parsePdf(localFilePath);
        result.parseMethod = 'PDF双层解析(pdf-parse + pdfjs-dist)';
      } else if (ext === '.docx') {
        text = await this.parseDocx(localFilePath);
        result.parseMethod = 'DOCX解析(docx + mammoth)';
      } else if (ext === '.doc') {
        text = await this.parseDoc(localFilePath);
        result.parseMethod = 'DOC解析(mammoth)';
      } else {
        throw new Error(`不支持的文件格式: ${ext}`);
      }

      result.rawText = text;
      this.logger.log(`提取文本长度: ${text.length} 字符`);

      const extracted = this.extractInfo(text, fileName);
      Object.assign(result, extracted);

      result.confidence = this.calculateConfidence(result, text.length);

      try {
        const aiEnhanced = await this.aiEnhanceParse(result, text);
        if (aiEnhanced) {
          Object.assign(result, aiEnhanced);
          result.confidence = Math.min(100, result.confidence + 5);
        }
      } catch (aiError: any) {
        this.logger.warn(`AI增强解析失败，使用基础解析结果: ${aiError.message}`);
      }

      fs.unlinkSync(localFilePath);
      this.logger.log(`临时文件已清理，解析完成，置信度: ${result.confidence}`);

      return result;
    } catch (error: any) {
      this.logger.error(`解析失败: ${error.message}`);
      result.error = error.message;
      result.confidence = 0;
      return result;
    }
  }

  private async downloadFile(fileUrl: string, fileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const localFilePath = path.join(tempDir, `${Date.now()}_${fileName}`);
      const fileStream = fs.createWriteStream(localFilePath);

      const client = fileUrl.startsWith('https') ? https : http;

      client.get(fileUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location as string;
          this.logger.log(`重定向到: ${redirectUrl}`);
          const redirectClient = redirectUrl.startsWith('https') ? https : http;
          redirectClient.get(redirectUrl, (redirectResponse) => {
            redirectResponse.pipe(fileStream);
          }).on('error', reject);
        } else {
          response.pipe(fileStream);
        }
      }).on('error', reject);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(localFilePath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(localFilePath, () => reject(err));
      });
    });
  }

  private async parsePdfFromBuffer(buffer: Buffer): Promise<string> {
    let combinedText = '';

    try {
      const pdfData = await pdfParse(buffer);
      combinedText = pdfData.text;
      this.logger.log(`pdf-parse 提取文本长度: ${combinedText.length}`);
    } catch (error: any) {
      this.logger.warn(`pdf-parse 解析失败: ${error.message}`);
    }

    try {
      const pdf = await (pdfjsLib as any).getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      }).promise;

      let pdfjsText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        pdfjsText += pageText + '\n';
      }
      this.logger.log(`pdfjs-dist 提取文本长度: ${pdfjsText.length}`);

      if (pdfjsText.length > combinedText.length) {
        combinedText = pdfjsText;
      } else if (pdfjsText.length > 0) {
        const set1 = new Set(combinedText.split(/\s+/));
        const set2 = new Set(pdfjsText.split(/\s+/));
        const union = new Set([...set1, ...set2]);
        if (union.size > set1.size) {
          combinedText = combinedText + '\n' + pdfjsText;
        }
      }
    } catch (error: any) {
      this.logger.warn(`pdfjs-dist 解析失败: ${error.message}`);
    }

    if (!combinedText || combinedText.trim().length === 0) {
      throw new Error('PDF文本提取失败，可能是扫描件或图片格式');
    }

    return this.cleanText(combinedText);
  }

  private async parsePdf(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    return this.parsePdfFromBuffer(dataBuffer);
  }

  private async parseDocxFromBuffer(buffer: Buffer): Promise<string> {
    let text = '';

    try {
      const mammothResult = await mammoth.extractRawText({ buffer });
      text = mammothResult.value;
      this.logger.log(`mammoth 提取文本长度: ${text.length}`);
    } catch (error: any) {
      this.logger.warn(`mammoth 解析失败: ${error.message}`);
    }

    try {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      const hasDocProps = zipEntries.some(e => e.entryName.startsWith('docProps/'));
      const hasWordDir = zipEntries.some(e => e.entryName.startsWith('word/'));
      const hasDocumentXml = zipEntries.some(e => e.entryName === 'word/document.xml');

      if (hasDocProps && hasWordDir && hasDocumentXml) {
        this.logger.log('DOCX 结构验证通过');

        if (!text || text.trim().length === 0) {
          const documentXmlEntry = zipEntries.find(e => e.entryName === 'word/document.xml');
          if (documentXmlEntry) {
            const xmlContent = documentXmlEntry.getData().toString('utf8');
            text = this.extractTextFromDocxXml(xmlContent);
            this.logger.log(`从 document.xml 提取文本长度: ${text.length}`);
          }
        }
      } else {
        this.logger.warn('DOCX 结构验证失败，可能文件已损坏');
      }
    } catch (error: any) {
      this.logger.warn(`DOCX 结构验证失败: ${error.message}`);
    }

    if (!text || text.trim().length === 0) {
      throw new Error('DOCX文本提取失败');
    }

    return this.cleanText(text);
  }

  private async parseDocx(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    return this.parseDocxFromBuffer(dataBuffer);
  }

  private extractTextFromDocxXml(xmlContent: string): string {
    let text = xmlContent.replace(/<w:tab[^>]*\/>/g, '\t');
    text = text.replace(/<w:br[^>]*\/>/g, '\n');
    text = text.replace(/<w:p[^>]*>.*?<\/w:p>/g, (match) => {
      const innerText = match.replace(/<[^>]+>/g, '');
      return innerText + '\n';
    });
    text = text.replace(/<[^>]+>/g, '');
    return text;
  }

  private async parseDocFromBuffer(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;

      if (!text || text.trim().length === 0) {
        throw new Error('DOC文本提取失败');
      }

      return this.cleanText(text);
    } catch (error: any) {
      throw new Error(`DOC解析失败: ${error.message}`);
    }
  }

  private async parseDoc(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    return this.parseDocFromBuffer(dataBuffer);
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .trim();
  }

  private extractInfo(text: string, fileName: string) {
    const info = {
      name: '',
      phone: '',
      email: '',
      workYears: 0,
      skills: [] as string[],
    };

    const phoneRegex = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches && phoneMatches.length > 0) {
      info.phone = phoneMatches[0];
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = text.match(emailRegex);
    if (emailMatches && emailMatches.length > 0) {
      info.email = emailMatches[0].toLowerCase();
    }

    const nameFromFile = fileName.match(/^([\u4e00-\u9fa5]{2,4})[_\-]/);
    if (nameFromFile) {
      info.name = nameFromFile[1];
    }
    if (!info.name) {
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim();
        const nameMatch = line.match(/^([\u4e00-\u9fa5]{2,4})$/);
        if (nameMatch && !this.isCommonWord(nameMatch[1])) {
          info.name = nameMatch[1];
          break;
        }
        const labelMatch = line.match(/(?:姓名|名字|Name)[:：\s]+([\u4e00-\u9fa5]{2,4})/);
        if (labelMatch) {
          info.name = labelMatch[1];
          break;
        }
      }
    }

    info.workYears = this.extractWorkYears(text);

    info.skills = this.extractSkills(text);

    return info;
  }

  private extractWorkYears(text: string): number {
    let workYears = 0;

    const patterns = [
      /(?:工作经验|工作年限|从业年限|工龄)[:：\s]*(\d+(?:\.\d+)?)\s*年/,
      /(\d+(?:\.\d+)?)\s*年(?:工作|经验|从业)/,
      /(\d+)\s*-\s*(\d+)\s*年(?:工作|经验)/,
      /(?:工作|从业)[:：\s]*(\d+(?:\.\d+)?)\s*年/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          workYears = (parseFloat(match[1]) + parseFloat(match[2])) / 2;
        } else {
          workYears = parseFloat(match[1]);
        }
        break;
      }
    }

    if (workYears === 0) {
      const yearPattern = /(20\d{2})\s*[-~至到]\s*(20\d{2}|至今|现在|20\d{2})/g;
      const timeRanges: { start: number; end: number }[] = [];
      let match;

      while ((match = yearPattern.exec(text)) !== null) {
        const startYear = parseInt(match[1]);
        const endStr = match[2];
        let endYear: number;

        if (endStr === '至今' || endStr === '现在') {
          endYear = new Date().getFullYear();
        } else {
          endYear = parseInt(endStr);
        }

        if (startYear >= 2000 && endYear >= startYear && endYear <= new Date().getFullYear()) {
          timeRanges.push({ start: startYear, end: endYear });
        }
      }

      if (timeRanges.length > 0) {
        timeRanges.sort((a, b) => a.start - b.start);
        const merged: { start: number; end: number }[] = [];

        for (const range of timeRanges) {
          if (merged.length === 0 || range.start > merged[merged.length - 1].end + 1) {
            merged.push({ ...range });
          } else {
            merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, range.end);
          }
        }

        const totalYears = merged.reduce((sum, r) => sum + (r.end - r.start), 0);
        workYears = Math.round(totalYears * 10) / 10;
      }
    }

    return Math.min(workYears, 50);
  }

  private extractSkills(text: string): string[] {
    const foundSkills = new Set<string>();

    for (const skill of this.skillKeywords) {
      const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9])${escapedSkill}($|\\s|[^a-zA-Z0-9])`, 'i');

      if (regex.test(text)) {
        foundSkills.add(skill);
      }
    }

    const techStackPattern = /【([^】]+)】|\[([^\]]+)\]|\(([^)]+)\)/g;
    let match;
    while ((match = techStackPattern.exec(text)) !== null) {
      const content = (match[1] || match[2] || match[3] || '').trim();
      if (content.length < 50) {
        const parts = content.split(/[,，、\/\s]+/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.length >= 2 && trimmed.length <= 20) {
            for (const skill of this.skillKeywords) {
              if (trimmed.toLowerCase() === skill.toLowerCase()) {
                foundSkills.add(skill);
              }
            }
          }
        }
      }
    }

    return Array.from(foundSkills);
  }

  private isCommonWord(word: string): boolean {
    const commonWords = [
      '简历', '个人', '求职', '应聘', '姓名', '性别', '年龄', '生日',
      '电话', '邮箱', '地址', '教育', '经历', '工作', '项目', '技能',
      '专业', '学校', '学历', '公司', '部门', '职位', '职责', '业绩',
    ];
    return commonWords.includes(word);
  }

  private calculateConfidence(result: ParseResultDto, textLength: number): number {
    let score = 0;
    const weights = {
      textLength: 20,
      name: 15,
      phone: 20,
      email: 15,
      workYears: 15,
      skills: 15,
    };

    const textScore = Math.min(100, (textLength / 500) * 100);
    score += (textScore * weights.textLength) / 100;

    if (result.name) {
      score += weights.name;
    }

    if (result.phone) {
      score += weights.phone;
    }

    if (result.email) {
      score += weights.email;
    }

    if (result.workYears > 0) {
      score += weights.workYears;
    }

    const skillScore = Math.min(100, (result.skills.length / 5) * 100);
    score += (skillScore * weights.skills) / 100;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  private async aiEnhanceParse(result: ParseResultDto, rawText: string): Promise<Partial<ParseResultDto> | null> {
    this.logger.log('AI增强解析占位 - 未配置AI服务');
    return null;
  }
}
