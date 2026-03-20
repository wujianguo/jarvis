import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ExpressPickupsService } from './express-pickups.service';
import { CreateExpressPickupDto } from './dto/create-express-pickup.dto';
import { UpdateExpressPickupDto } from './dto/update-express-pickup.dto';
import { ExpressPickupDto } from './dto/express-pickup.dto';
import { MarkDoneByCodeDto } from './dto/mark-done-by-code.dto';
import { ExpressPickupStatus } from './express-pickup-status.enum';

@ApiTags('express')
@Controller('express/pickups')
export class ExpressPickupsController {
  constructor(private readonly service: ExpressPickupsService) {}

  @Post()
  @ApiOperation({
    summary: '创建快递取件记录',
    description: '写入 Bitable 并同步创建飞书任务，将任务 ID 回写到记录',
  })
  @ApiResponse({ status: 201, type: ExpressPickupDto, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  create(@Body() dto: CreateExpressPickupDto): Promise<ExpressPickupDto> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询快递取件记录列表' })
  @ApiQuery({
    name: 'status',
    enum: ExpressPickupStatus,
    required: false,
    description: '按状态筛选，默认为未取件',
  })
  @ApiResponse({
    status: 200,
    type: [ExpressPickupDto],
    description: '记录列表',
  })
  findAll(
    @Query('status') status?: ExpressPickupStatus,
  ): Promise<ExpressPickupDto[]> {
    return this.service.findAll(status);
  }

  @Post('done-by-code')
  @ApiOperation({
    summary: '通过取件码标记已取件',
    description:
      '查找取件码匹配且状态为未取件的记录；多条匹配时取更新时间最新的一条；' +
      '将状态更新为已取件，并同步完成对应飞书任务（若存在 taskId）。' +
      '无匹配的未取件记录时返回 404。',
  })
  @ApiBody({ type: MarkDoneByCodeDto })
  @ApiResponse({
    status: 201,
    type: ExpressPickupDto,
    description: '标记成功，返回更新后的记录',
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 404, description: '未找到匹配的未取件记录' })
  markDoneByCode(@Body() dto: MarkDoneByCodeDto): Promise<ExpressPickupDto> {
    return this.service.markDoneByCode(dto.pickupCode);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单条快递取件记录' })
  @ApiParam({ name: 'id', description: '取件记录 ID' })
  @ApiResponse({ status: 200, type: ExpressPickupDto, description: '记录详情' })
  @ApiResponse({ status: 404, description: '记录不存在' })
  findOne(@Param('id') id: string): Promise<ExpressPickupDto> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新快递取件记录',
    description: '更新 Bitable 并同步更新飞书任务',
  })
  @ApiParam({ name: 'id', description: '取件记录 ID' })
  @ApiResponse({ status: 200, type: ExpressPickupDto, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 404, description: '记录不存在' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpressPickupDto,
  ): Promise<ExpressPickupDto> {
    return this.service.update(id, dto);
  }

  @Post(':id/done')
  @ApiOperation({
    summary: '标记快递已取件（按 ID）',
    description:
      '将指定记录的状态更新为已取件，更新 更新时间，并同步完成对应飞书任务（若存在 taskId）。' +
      '幂等：若记录已为已取件，仍正常返回当前记录并尝试完成任务，不会报错。',
  })
  @ApiParam({ name: 'id', description: '取件记录 ID' })
  @ApiResponse({
    status: 201,
    type: ExpressPickupDto,
    description: '标记成功，返回更新后的记录',
  })
  @ApiResponse({ status: 404, description: '记录不存在' })
  markDone(@Param('id') id: string): Promise<ExpressPickupDto> {
    return this.service.markDone(id);
  }
}
