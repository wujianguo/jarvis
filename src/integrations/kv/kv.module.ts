import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KvService } from './kv.service';

@Module({
  imports: [HttpModule],
  providers: [KvService],
  exports: [KvService],
})
export class KvModule {}
