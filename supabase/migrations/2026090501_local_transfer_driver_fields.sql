alter table public.attendees
  add column if not exists outbound_transfer_driver_name text,
  add column if not exists outbound_transfer_driver_phone text,
  add column if not exists outbound_transfer_vehicle text,
  add column if not exists return_transfer_driver_name text,
  add column if not exists return_transfer_driver_phone text,
  add column if not exists return_transfer_vehicle text;

comment on column public.attendees.outbound_transfer_driver_name is '去程出发地（属地）送站司机姓名';
comment on column public.attendees.outbound_transfer_driver_phone is '去程出发地（属地）送站司机联系电话';
comment on column public.attendees.outbound_transfer_vehicle is '去程出发地（属地）送站车辆或车牌号';
comment on column public.attendees.return_transfer_driver_name is '返程出发地（属地）接站司机姓名';
comment on column public.attendees.return_transfer_driver_phone is '返程出发地（属地）接站司机联系电话';
comment on column public.attendees.return_transfer_vehicle is '返程出发地（属地）接站车辆或车牌号';

notify pgrst, 'reload schema';
