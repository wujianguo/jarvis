import { Injectable, Logger } from '@nestjs/common';
import { generateText, Output } from 'ai';
import { createAiGateway } from 'ai-gateway-provider';
import { createOpenAI } from 'ai-gateway-provider/providers/openai';
import { z } from 'zod';
import { AppConfigService } from '../../config/app-config.service';
import { SmsClassificationResult } from './interfaces/sms-handler.interface';

const classificationSchema = z.object({
  kind: z.enum(['express_pickup', 'other', 'unknown']),
  pickupCode: z.string().nullable(),
  address: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

@Injectable()
export class SmsAiService {
  private readonly logger = new Logger(SmsAiService.name);

  constructor(private readonly config: AppConfigService) {}

  async classifySms(content: string): Promise<SmsClassificationResult> {
    const { cloudflareAccountId, gatewayName, cfAigToken } = this.config.ai;
    const aigateway = createAiGateway({
      accountId: cloudflareAccountId,
      gateway: gatewayName,
      apiKey: cfAigToken,
    });

    const openai = createOpenAI();

    try {
      const result = await generateText({
        model: aigateway(openai.chat('gpt-5-mini')),
        output: Output.object({
          schema: classificationSchema,
          name: 'sms_classification',
          description: '短信分类结果，包含类型、关键信息和置信度',
        }),
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

      return result.output;
    } catch (err) {
      this.logger.warn(`AI classification failed: ${String(err)}`);
      return { kind: 'unknown', confidence: 0 };
    }
  }
}
