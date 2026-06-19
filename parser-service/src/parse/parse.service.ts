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

  // 常用技能标签库
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

  // 主解析入口
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
      
      // 1. 下载文件到本地临时目录
      const localFilePath = await this.downloadFile(fileUrl, fileName);
      this.logger.log(`文件已下载到: ${localFilePath}`);

      // 2. 根据文件扩展名选择解析方法
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

      // 3. 使用正则规则引擎提取结构化信息
      const extracted = this.extractInfo(text, fileName);
      Object.assign(result, extracted);

      // 4. 计算置信度分数
      result.confidence = this.calculateConfidence(result, text.length);

      // 5. 调用AI接口（预留占位）
      try {
        const aiEnhanced = await this.aiEnhanceParse(result, text);
        if (aiEnhanced) {
          Object.assign(result, aiEnhanced);
          result.confidence = Math.min(100, result.confidence + 5);
        }
      } catch (aiError) {
        this.logger.warn(`AI增强解析失败，使用基础解析结果: ${aiError.message}`);
      }

      // 6. 清理临时文件
      fs.unlinkSync(localFilePath);
      this.logger.log(`临时文件已清理，解析完成，置信度: ${result.confidence}`);

      return result;
    } catch (error) {
      this.logger.error(`解析失败: ${error.message}`);
      result.error = error.message;
      result.confidence = 0;
      return result;
    }
  }

  // 下载文件到本地临时目录
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
          const redirectUrl = response.headers.location;
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

  // PDF解析 - 双层提取
  private async parsePdf(filePath: string): Promise<string> {
    let combinedText = '';

    try {
      // 第一层：使用 pdf-parse 提取
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      combinedText = pdfData.text;
      this.logger.log(`pdf-parse 提取文本长度: ${combinedText.length}`);
    } catch (error) {
      this.logger.warn(`pdf-parse 解析失败: ${error.message}`);
    }

    try {
      // 第二层：使用 pdfjs-dist 提取（更可靠的文本层提取）
      const dataBuffer = fs.readFileSync(filePath);
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(dataBuffer),
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

      // 合并两个提取结果，取更完整的
      if (pdfjsText.length > combinedText.length) {
        combinedText = pdfjsText;
      } else if (pdfjsText.length > 0) {
        // 合并去重
        const set1 = new Set(combinedText.split(/\s+/));
        const set2 = new Set(pdfjsText.split(/\s+/));
        const union = new Set([...set1, ...set2]);
        if (union.size > set1.size) {
          combinedText = combinedText + '\n' + pdfjsText;
        }
      }
    } catch (error) {
      this.logger.warn(`pdfjs-dist 解析失败: ${error.message}`);
    }

    if (!combinedText || combinedText.trim().length === 0) {
      throw new Error('PDF文本提取失败，可能是扫描件或图片格式');
    }

    return this.cleanText(combinedText);
  }

  // DOCX解析
  private async parseDocx(filePath: string): Promise<string> {
    let text = '';

    try {
      // 第一层：使用 mammoth 提取文本
      const dataBuffer = fs.readFileSync(filePath);
      const mammothResult = await mammoth.extractRawText({ buffer: dataBuffer });
      text = mammothResult.value;
      this.logger.log(`mammoth 提取文本长度: ${text.length}`);
    } catch (error) {
      this.logger.warn(`mammoth 解析失败: ${error.message}`);
    }

    try {
      // 第二层：使用 adm-zip 验证 DOCX 结构（DOCX 本质是 ZIP 文件）
      const dataBuffer = fs.readFileSync(filePath);
      const zip = new AdmZip(dataBuffer);
      const zipEntries = zip.getEntries();
      // 检查是否包含 DOCX 核心文件
      const hasDocProps = zipEntries.some(e => e.entryName.startsWith('docProps/'));
      const hasWordDir = zipEntries.some(e => e.entryName.startsWith('word/'));
      const hasDocumentXml = zipEntries.some(e => e.entryName === 'word/document.xml');
      
      if (hasDocProps && hasWordDir && hasDocumentXml) {
        this.logger.log('DOCX 结构验证通过');
        
        // 如果 mammoth 提取失败，尝试直接从 document.xml 提取文本
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
    } catch (error) {
      this.logger.warn(`DOCX 结构验证失败: ${error.message}`);
    }

    if (!text || text.trim().length === 0) {
      throw new Error('DOCX文本提取失败');
    }

    return this.cleanText(text);
  }

  // 从 DOCX XML 中提取纯文本
  private extractTextFromDocxXml(xmlContent: string): string {
    // 移除 XML 标签，只保留文本内容
    let text = xmlContent.replace(/<w:tab[^>]*\/>/g, '\t');
    text = text.replace(/<w:br[^>]*\/>/g, '\n');
    text = text.replace(/<w:p[^>]*>.*?<\/w:p>/g, (match) => {
      const innerText = match.replace(/<[^>]+>/g, '');
      return innerText + '\n';
    });
    text = text.replace(/<[^>]+>/g, '');
    return text;
  }

  // DOC解析（旧版Word）
  private async parseDoc(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      const text = result.value;

      if (!text || text.trim().length === 0) {
        throw new Error('DOC文本提取失败');
      }

      return this.cleanText(text);
    } catch (error) {
      throw new Error(`DOC解析失败: ${error.message}`);
    }
  }

  // 清理文本
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .trim();
  }

  // 正则规则引擎 - 提取结构化信息
  private extractInfo(text: string, fileName: string) {
    const info = {
      name: '',
      phone: '',
      email: '',
      workYears: 0,
      skills: [] as string[],
    };

    // 1. 提取手机号：中国大陆1开头11位
    const phoneRegex = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches && phoneMatches.length > 0) {
      info.phone = phoneMatches[0];
    }

    // 2. 提取邮箱
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = text.match(emailRegex);
    if (emailMatches && emailMatches.length > 0) {
      info.email = emailMatches[0].toLowerCase();
    }

    // 3. 提取姓名
    // 策略1：从文件名提取（常见简历命名：张三_前端开发.pdf）
    const nameFromFile = fileName.match(/^([\u4e00-\u9fa5]{2,4})[_\-]/);
    if (nameFromFile) {
      info.name = nameFromFile[1];
    }
    // 策略2：从文本开头提取
    if (!info.name) {
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim();
        // 匹配2-4个中文字符的姓名
        const nameMatch = line.match(/^([\u4e00-\u9fa5]{2,4})$/);
        if (nameMatch && !this.isCommonWord(nameMatch[1])) {
          info.name = nameMatch[1];
          break;
        }
        // 匹配 "姓名：张三" 格式
        const labelMatch = line.match(/(?:姓名|名字|Name)[:：\s]+([\u4e00-\u9fa5]{2,4})/);
        if (labelMatch) {
          info.name = labelMatch[1];
          break;
        }
      }
    }

    // 4. 提取工作年限
    info.workYears = this.extractWorkYears(text);

    // 5. 提取技能标签
    info.skills = this.extractSkills(text);

    return info;
  }

  // 提取工作年限
  private extractWorkYears(text: string): number {
    let workYears = 0;

    // 匹配 "工作经验：5年"、"5年经验"、"工作年限 3-5年" 等格式
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
          // 区间取中间值
          workYears = (parseFloat(match[1]) + parseFloat(match[2])) / 2;
        } else {
          workYears = parseFloat(match[1]);
        }
        break;
      }
    }

    // 策略二：根据工作经历时间计算
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

      // 合并重叠区间并计算总年限
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

    return Math.min(workYears, 50); // 上限50年
  }

  // 提取技能标签
  private extractSkills(text: string): string[] {
    const foundSkills = new Set<string>();
    const lowerText = text.toLowerCase();

    for (const skill of this.skillKeywords) {
      // 精确匹配，确保是独立单词
      const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9])${escapedSkill}($|\\s|[^a-zA-Z0-9])`, 'i');
      
      if (regex.test(text)) {
        foundSkills.add(skill);
      }
    }

    // 额外提取括号中的技术栈
    const techStackPattern = /【([^】]+)】|\[([^\]]+)\]|\(([^)]+)\)/g;
    let match;
    while ((match = techStackPattern.exec(text)) !== null) {
      const content = (match[1] || match[2] || match[3] || '').trim();
      if (content.length < 50) {
        const parts = content.split(/[,，、\/\s]+/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.length >= 2 && trimmed.length <= 20) {
            // 检查是否匹配技能库
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

  // 判断是否为常见词（排除误匹配的姓名）
  private isCommonWord(word: string): boolean {
    const commonWords = [
      '简历', '个人', '求职', '应聘', '姓名', '性别', '年龄', '生日',
      '电话', '邮箱', '地址', '教育', '经历', '工作', '项目', '技能',
      '专业', '学校', '学历', '公司', '部门', '职位', '职责', '业绩',
    ];
    return commonWords.includes(word);
  }

  // 计算置信度分数 (0-100)
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

    // 文本长度评分 (500字符以上满分)
    const textScore = Math.min(100, (textLength / 500) * 100);
    score += (textScore * weights.textLength) / 100;

    // 姓名评分
    if (result.name) {
      score += weights.name;
    }

    // 手机号评分
    if (result.phone) {
      score += weights.phone;
    }

    // 邮箱评分
    if (result.email) {
      score += weights.email;
    }

    // 工作年限评分
    if (result.workYears > 0) {
      score += weights.workYears;
    }

    // 技能评分 (5个以上满分)
    const skillScore = Math.min(100, (result.skills.length / 5) * 100);
    score += (skillScore * weights.skills) / 100;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  // AI接口占位函数
  private async aiEnhanceParse(result: ParseResultDto, rawText: string): Promise<Partial<ParseResultDto> | null> {
    // 预留AI接口占位
    // 这里可以接入大语言模型进行更智能的解析
    // 例如：OpenAI GPT、文心一言、通义千问等
    
    // TODO: 实现AI增强解析逻辑
    // const aiResponse = await this.callAIAPI(rawText);
    // return {
    //   name: aiResponse.name,
    //   skills: [...result.skills, ...aiResponse.extraSkills],
    // };
    
    this.logger.log('AI增强解析占位 - 未配置AI服务');
    return null;
  }
}
