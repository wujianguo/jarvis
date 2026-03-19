import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ExpressPickupsService } from './express-pickups.service';
import { CreateExpressPickupDto } from './dto/create-express-pickup.dto';
import { UpdateExpressPickupDto } from './dto/update-express-pickup.dto';
import { ExpressPickupDto } from './dto/express-pickup.dto';

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
  @ApiResponse({
    status: 200,
    type: [ExpressPickupDto],
    description: '记录列表',
  })
  findAll(): Promise<ExpressPickupDto[]> {
    return this.service.findAll();
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
}
