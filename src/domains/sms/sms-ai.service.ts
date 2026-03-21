import { Injectable, Logger } from '@nestjs/common';
import { generateObject, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { AppConfigService } from '../../config/app-config.service';
import { SmsClassificationResult } from './interfaces/sms-handler.interface';

const classificationSchema = z.object({
  kind: z.enum(['express_pickup', 'other', 'unknown']),
  pickupCode: z.string().optional(),
  address: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

@Injectable()
export class SmsAiService {
  private readonly logger = new Logger(SmsAiService.name);

  constructor(private readonly config: AppConfigService) {}

  async classifySms(content: string): Promise<SmsClassificationResult> {
    const { apiKey, model, baseURL } = this.config.ai;

    const openai = createOpenAI({ apiKey, baseURL });

    try {
      // Type assertion needed due to @ai-sdk/openai version mismatch with ai@5
      const { object } = await generateObject({
        model: openai(model) as unknown as LanguageModel,
        schema: classificationSchema,
        system: [
          '你是一个短信分类助手。请分析下面的短信内容，判断其类型并提取关键信息。',
          '类型说明：',
          '- express_pickup：快递/包裹取件通知，包含取件码或提货码',
          '- other：其他明确类型的短信（验证码、账单、营销等）',
          '- unknown：无法判断类型',
          '如果是 express_pickup，请尽力提取 pickupCode（取件码/验证码/提货码）和 address（取件地址）。',
          'confidence 表示分类置信度（0~1）。',
        ].join('\n'),
        prompt: `短信内容：\n${content}`,
      });

      return object;
    } catch (err) {
      this.logger.warn(`AI classification failed: ${String(err)}`);
      return { kind: 'unknown', confidence: 0 };
    }
  }
}
