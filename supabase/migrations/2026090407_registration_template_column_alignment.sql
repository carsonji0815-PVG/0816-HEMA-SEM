-- Repair registration-template columns by their headings instead of their
-- physical positions. Some customer templates omit or reorder standard
-- columns, so positional mapping can shift every value after the omission.
alter table public.meetings disable trigger meetings_guard_management_staff;
select set_config('app.registration_config_rpc', 'on', true);

with repaired as (
  select
    meeting.id,
    jsonb_set(
      meeting.registration_template,
      '{columns}',
      coalesce((
        select jsonb_agg(
          case when mapped.field_key is null then source.item
          else jsonb_set(
            jsonb_set(source.item, '{key}', to_jsonb(mapped.field_key), true),
            '{custom}', 'false'::jsonb, true
          ) end
          order by source.ordinality
        )
        from jsonb_array_elements(meeting.registration_template->'columns') with ordinality as source(item, ordinality)
        cross join lateral (
          select lower(coalesce(source.item->>'header', '')) as heading
        ) normalized
        cross join lateral (
          select case
            when normalized.heading ~ '(^|[[:space:]])no[.]?([[:space:]]|$)|序号' then 'sequence'
            when normalized.heading ~ 'attendee[[:space:]]*type|参会者类别|参会类别' then 'attendeeType'
            when normalized.heading ~ '销售联系人手机|contact[[:space:]]*mobile' then 'contactMobile'
            when normalized.heading ~ '销售联系人姓名|contact[[:space:]]*name' then 'contactName'
            when normalized.heading ~ '去程送站出发地点|接送出发地点|outbound[[:space:]_-]*transfer[[:space:]_-]*origin' then 'outboundTransferOrigin'
            when normalized.heading ~ '预约送站时间|预计送站时间|outbound[[:space:]_-]*transfer[[:space:]_-]*time' then 'outboundTransferTime'
            when normalized.heading ~ '去程送站备注|outbound[[:space:]_-]*transfer[[:space:]_-]*notes' then 'outboundTransferNotes'
            when normalized.heading ~ '返程接站送达目的地|送达目的地|return[[:space:]_-]*transfer[[:space:]_-]*destination' then 'returnTransferDestination'
            when normalized.heading ~ '预估接站时间|return[[:space:]_-]*transfer[[:space:]_-]*time' then 'returnTransferTime'
            when normalized.heading ~ '返程接站备注|return[[:space:]_-]*transfer[[:space:]_-]*notes' then 'returnTransferNotes'
            when normalized.heading ~ '返程出发日期|return[[:space:]_-]*depart[[:space:]_-]*date' then 'returnDepartDate'
            when normalized.heading ~ '返程出发城市|return[[:space:]_-]*depart[[:space:]_-]*city' then 'returnDepartCity'
            when normalized.heading ~ '返程(出发)?出行方式|返程出发方式|return[[:space:]_-]*depart[[:space:]_-]*transport' then 'returnDepartTransportType'
            when normalized.heading ~ '返程出发场站|return[[:space:]_-]*depart[[:space:]_-]*station' then 'returnDepartStation'
            when normalized.heading ~ '返程抵达日期|return[[:space:]_-]*arrive[[:space:]_-]*date' then 'returnArriveDate'
            when normalized.heading ~ '返程抵达城市|return[[:space:]_-]*arrive[[:space:]_-]*city' then 'returnArriveCity'
            when normalized.heading ~ '返程抵达出行方式|返程抵达方式|return[[:space:]_-]*arrive[[:space:]_-]*transport' then 'returnArriveTransportType'
            when normalized.heading ~ '返程抵达场站|return[[:space:]_-]*arrive[[:space:]_-]*station' then 'returnArriveStation'
            when normalized.heading ~ '返程.*(航班|车次)|return.*(flight|train)' then 'returnNo'
            when normalized.heading ~ '返程.*出发时间|return.*departure[[:space:]]*time' then 'returnDeparture'
            when normalized.heading ~ '返程.*(到达|抵达)时间|return.*arrival[[:space:]]*time' then 'returnArrival'
            when normalized.heading ~ '去程出发日期' then 'departDate'
            when normalized.heading ~ '去程出发城市' then 'departCity'
            when normalized.heading ~ '去程(出发)?出行方式|去程出发方式' then 'departTransportType'
            when normalized.heading ~ '去程出发场站' then 'departStation'
            when normalized.heading ~ '去程抵达日期' then 'arriveDate'
            when normalized.heading ~ '去程抵达城市' then 'arriveCity'
            when normalized.heading ~ '去程抵达出行方式|去程抵达方式' then 'arriveTransportType'
            when normalized.heading ~ '去程抵达场站' then 'arriveStation'
            when normalized.heading ~ '^(航班|车次)|flight[[:space:]*/_-]*train[[:space:]]*no' then 'outNo'
            when normalized.heading ~ '^出发时间|departure[[:space:]]*time' then 'outDeparture'
            when normalized.heading ~ '^(到达|抵达)时间|arrival[[:space:]]*time' then 'outArrival'
            when normalized.heading ~ '返回日期|return[[:space:]]*date' then 'returnDate'
            when normalized.heading ~ '所属[[:space:]]*bu|business[[:space:]]*unit' then 'businessUnit'
            when normalized.heading ~ '员工号|员工编号|employee[[:space:]]*no' then 'employeeNo'
            when normalized.heading ~ '职位|position' then 'internalPosition'
            when normalized.heading ~ '衣服尺寸|服装尺寸|clothing[[:space:]]*size' then 'clothingSize'
            when normalized.heading ~ '客户编号|hcp[[:space:]]*id' then 'hcpId'
            when normalized.heading ~ '身份证|护照|passport|id[[:space:]*/_-]*passport' then 'idNumber'
            when normalized.heading ~ '手机号|mobile[[:space:]]*phone' then 'phone'
            when normalized.heading ~ '客户姓名|姓名|name' then 'name'
            when normalized.heading ~ '医院|连锁|hospital|chain' then 'hospital'
            when normalized.heading ~ '科室|门店|department|store' then 'department'
            when normalized.heading ~ '职称|title' then 'title'
            when normalized.heading ~ '会场|venue' then 'venue'
            when normalized.heading ~ '性别|sex' then 'sex'
            when normalized.heading ~ '住宿安排.*(单间|标间)|房型|room[[:space:]]*type' then 'roomType'
            when normalized.heading ~ '住宿需求|住宿安排|accommodation' then 'accommodation'
            when normalized.heading ~ '是否航空|flight.*y.?n' then 'flight'
            when normalized.heading ~ '大区|region' then 'region'
            when normalized.heading ~ 'msl' then 'mslContact'
            when normalized.heading ~ '备注|remarks?' then 'remarks'
            when normalized.heading ~ '城市|city' then 'city'
            else null
          end as field_key
        ) mapped
      ), '[]'::jsonb),
      true
    ) as registration_template
  from public.meetings meeting
  where jsonb_typeof(meeting.registration_template->'columns') = 'array'
)
update public.meetings meeting
set registration_template = repaired.registration_template,
    settings_version = coalesce(meeting.settings_version, 0) + 1
from repaired
where meeting.id = repaired.id
  and meeting.registration_template is distinct from repaired.registration_template;

alter table public.meetings enable trigger meetings_guard_management_staff;
