import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { WecomHttpService } from '../http/wecom-http.service';

export interface SendMessageResult {
  errcode: number;
  errmsg: string;
  invaliduser?: string;
  invalidparty?: string;
  invalidtag?: string;
  unlicenseduser?: string;
  msgid?: string;
}

export interface SendTextOptions {
  /** Comma-separated user IDs, or '@all' for all members */
  toUser?: string;
  /** Comma-separated department IDs */
  toParty?: string;
  /** Comma-separated tag IDs */
  toTag?: string;
  /** Text content (required) */
  content: string;
  /** 0 = non-confidential (default), 1 = confidential */
  safe?: 0 | 1;
}

@Injectable()
export class WecomMessageService {
  constructor(
    private readonly httpService: WecomHttpService,
    private readonly config: AppConfigService,
  ) {}

  async sendText(options: SendTextOptions): Promise<SendMessageResult> {
    const agentId = this.config.wecom.agentId;
    if (!agentId) {
      throw new Error('WECOM_AGENT_ID is required for sending messages');
    }

    const payload: Record<string, unknown> = {
      msgtype: 'text',
      agentid: agentId,
      text: { content: options.content },
      safe: options.safe ?? 0,
    };

    if (options.toUser !== undefined) payload.touser = options.toUser;
    if (options.toParty !== undefined) payload.toparty = options.toParty;
    if (options.toTag !== undefined) payload.totag = options.toTag;

    // At least one recipient target must be specified; default to '@all'
    if (!options.toUser && !options.toParty && !options.toTag) {
      payload.touser = '@all';
    }

    return this.httpService.post<SendMessageResult>(
      '/cgi-bin/message/send',
      payload,
    );
  }
}
