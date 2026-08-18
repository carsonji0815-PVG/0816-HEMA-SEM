(() => {
  "use strict";

  const STORAGE_KEY = "journey-desk-state-v1";
  const COLUMN_LOCKS = [
    ["identity", "身份与证件"], ["contact", "手机号"], ["outbound", "去程"],
    ["return", "返程"], ["accommodation", "住宿"], ["transport", "接送机"], ["remarks", "备注"],
  ];

  const initialState = () => ({
    currentUserId: "u-ops",
    users: [
      { id: "u-ops", name: "林悦", role: "ops", label: "会务负责人" },
      { id: "u-client", name: "周宁", role: "client", label: "会议负责人（客户）" },
      { id: "u-sales-1", name: "陈哲", role: "sales", label: "销售负责人" },
      { id: "u-sales-2", name: "王珂", role: "sales", label: "销售负责人" },
    ],
    settings: {
      eventName: "HEMA SEM · 大连 & 福州",
      deadline: "2026-08-26T18:00",
      capacity: 120,
      allowedCities: ["上海", "北京", "广州", "杭州", "南京", "厦门"],
      mismatchRule: true,
      departureRule: true,
    },
    locks: { master: false, columns: ["identity"], rows: ["a-104"] },
    attendees: [
      {
        id: "a-101", attendeeType: "HCP", name: "许安然", city: "上海", hospital: "华东示范医院", department: "血液科", title: "主任医师", venue: "大连会场", sex: "女", idNumber: "310***********284", phone: "13800005201", hcpId: "HCP-26081", accommodation: "Y", flight: "Y", region: "华东大区", mslContact: "宋老师", remarks: "VIP，前排座位", ownerId: "u-sales-1",
        outDate: "2026-09-04", outFrom: "上海", outTo: "大连", outNo: "MU5661", outDeparture: "08:10", outArrival: "10:05",
        returnDate: "2026-09-06", returnFrom: "大连", returnTo: "上海", returnNo: "MU5682", returnDeparture: "18:40", returnArrival: "20:35",
        approval: "normal", risks: [], createdAt: "2026-08-17T09:20:00+08:00",
        transport: { pickup: { driver: "刘师傅", phone: "139****7712", vehicle: "辽B·72K18 · 别克GL8", time: "2026-09-04 10:25", point: "大连周水子机场 2号门" }, dropoff: { driver: "刘师傅", phone: "139****7712", vehicle: "辽B·72K18 · 别克GL8", time: "2026-09-06 16:10", point: "酒店大堂" } },
      },
      {
        id: "a-102", attendeeType: "HCP", name: "顾明远", city: "杭州", hospital: "浙江示范医学中心", department: "肿瘤内科", title: "副主任医师", venue: "大连会场", sex: "男", idNumber: "330***********516", phone: "13800005202", hcpId: "HCP-26082", accommodation: "Y", flight: "Y", region: "华东大区", mslContact: "宋老师", remarks: "", ownerId: "u-sales-1",
        outDate: "2026-09-04", outFrom: "杭州", outTo: "大连", outNo: "CZ6432", outDeparture: "07:35", outArrival: "09:55",
        returnDate: "2026-09-06", returnFrom: "大连", returnTo: "南京", returnNo: "CA8945", returnDeparture: "19:20", returnArrival: "21:05",
        approval: "pending", risks: ["去程出发城市与返程到达城市不一致"], createdAt: "2026-08-17T10:35:00+08:00",
        transport: { pickup: { driver: "待分配", phone: "—", vehicle: "待分配", time: "2026-09-04 10:15", point: "大连周水子机场" }, dropoff: { driver: "待分配", phone: "—", vehicle: "待分配", time: "2026-09-06 16:50", point: "酒店大堂" } },
      },
      {
        id: "a-103", attendeeType: "HCP", name: "梁知夏", city: "厦门", hospital: "海峡示范医院", department: "药学部", title: "主任药师", venue: "福州会场", sex: "女", idNumber: "350***********726", phone: "13800005203", hcpId: "HCP-26083", accommodation: "N", flight: "N", region: "华南大区", mslContact: "方老师", remarks: "本地客户", ownerId: "u-sales-2",
        outDate: "2026-09-11", outFrom: "厦门", outTo: "福州", outNo: "D6208", outDeparture: "08:47", outArrival: "10:18",
        returnDate: "2026-09-12", returnFrom: "福州", returnTo: "厦门", returnNo: "D6235", returnDeparture: "18:22", returnArrival: "19:55",
        approval: "normal", risks: [], createdAt: "2026-08-16T16:12:00+08:00",
        transport: { pickup: { driver: "林师傅", phone: "137****6019", vehicle: "闽A·8F21Q · 大众威然", time: "2026-09-11 10:35", point: "福州南站 北广场" }, dropoff: { driver: "林师傅", phone: "137****6019", vehicle: "闽A·8F21Q · 大众威然", time: "2026-09-12 16:25", point: "会议酒店大堂" } },
      },
      {
        id: "a-104", attendeeType: "HCP", name: "叶书言", city: "苏州", hospital: "苏城示范医院", department: "血液科", title: "主治医师", venue: "福州会场", sex: "男", idNumber: "320***********113", phone: "13800005204", hcpId: "HCP-26084", accommodation: "Y", flight: "Y", region: "华东大区", mslContact: "方老师", remarks: "已出票", ownerId: "u-sales-2",
        outDate: "2026-09-11", outFrom: "苏州", outTo: "福州", outNo: "G1651", outDeparture: "07:58", outArrival: "13:20",
        returnDate: "2026-09-12", returnFrom: "福州", returnTo: "苏州", returnNo: "G1660", returnDeparture: "17:43", returnArrival: "22:55",
        approval: "pending", risks: ["出发城市“苏州”不在预设范围"], createdAt: "2026-08-16T14:50:00+08:00",
        transport: { pickup: { driver: "郑师傅", phone: "136****2210", vehicle: "闽A·33L9P · 别克GL8", time: "2026-09-11 13:40", point: "福州站 南广场" }, dropoff: { driver: "郑师傅", phone: "136****2210", vehicle: "闽A·33L9P · 别克GL8", time: "2026-09-12 15:35", point: "会议酒店大堂" } },
      },
      {
        id: "a-105", attendeeType: "HCP", name: "沈清和", city: "北京", hospital: "京北示范医院", department: "内分泌科", title: "主任医师", venue: "大连会场", sex: "女", idNumber: "110***********842", phone: "13800005205", hcpId: "HCP-26085", accommodation: "Y", flight: "Y", region: "北区", mslContact: "宋老师", remarks: "", ownerId: "u-sales-1",
        outDate: "2026-09-04", outFrom: "北京", outTo: "大连", outNo: "CA8902", outDeparture: "09:10", outArrival: "10:35",
        returnDate: "2026-09-06", returnFrom: "大连", returnTo: "北京", returnNo: "CA8909", returnDeparture: "20:05", returnArrival: "21:30",
        approval: "approved", risks: [], createdAt: "2026-08-15T11:08:00+08:00",
        transport: { pickup: { driver: "高师傅", phone: "138****0907", vehicle: "辽B·5P73A · 红旗HQ9", time: "2026-09-04 10:55", point: "大连周水子机场 2号门" }, dropoff: { driver: "高师傅", phone: "138****0907", vehicle: "辽B·5P73A · 红旗HQ9", time: "2026-09-06 17:35", point: "酒店大堂" } },
      },
    ],
    notifications: [
      { id: "n-1", type: "change", text: "陈哲修改了顾明远的返程到达城市：杭州 → 南京", time: "2026-08-18T09:42:00+08:00", read: false },
      { id: "n-2", type: "approval", text: "沈清和的异常行程已由周宁审批通过", time: "2026-08-18T08:16:00+08:00", read: false },
      { id: "n-3", type: "lock", text: "会务负责人锁定了叶书言的报名信息", time: "2026-08-17T18:05:00+08:00", read: true },
      { id: "n-4", type: "create", text: "王珂新增报名：梁知夏 · 福州会场", time: "2026-08-16T16:12:00+08:00", read: true },
    ],
  });

  let state = loadState();
  let activeTransportFilter = "all";
  let backend = null;
  let backendMeetingId = null;
  let syncTimer = null;
  let lastLookupSchedule = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const normalizePhone = value => String(value || "").replace(/\D/g, "").slice(-11);
  const currentUser = () => state.users.find(user => user.id === state.currentUserId) || state.users[0];
  const userName = id => state.users.find(user => user.id === id)?.name || "未分配";
  const visibleAttendees = () => currentUser().role === "sales" ? state.attendees.filter(item => item.ownerId === currentUser().id) : state.attendees;
  const canManage = () => ["ops", "client"].includes(currentUser().role);
  const isLocked = attendee => state.locks.master || state.locks.rows.includes(attendee.id);

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved?.attendees ? saved : initialState();
    } catch { return initialState(); }
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (backend) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => syncBackend().catch(error => toast(`云端保存失败：${error.message}`, "error")), 250);
    }
  }
  function toast(message, type = "success") {
    const node = document.createElement("div"); node.className = `toast ${type === "error" ? "error" : ""}`; node.textContent = message;
    $("#toastRegion").append(node); setTimeout(() => node.remove(), 3200);
  }
  function addNotification(type, text) {
    state.notifications.unshift({ id: `n-${Date.now()}`, type, text, time: new Date().toISOString(), read: false });
  }
  function fmtDate(date) {
    if (!date) return "—";
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(`${date}T00:00:00`));
  }
  function relativeTime(value) {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (mins < 1) return "刚刚"; if (mins < 60) return `${mins} 分钟前`; if (mins < 1440) return `${Math.floor(mins / 60)} 小时前`;
    return `${Math.floor(mins / 1440)} 天前`;
  }
  function maskName(name) { return name.length > 1 ? `${name[0]}${"*".repeat(name.length - 1)}` : name; }
  function approvalLabel(value) { return ({ pending: "待审批", approved: "已通过", normal: "行程正常" })[value] || value; }

  function evaluateRisks(data) {
    const risks = [];
    if (state.settings.mismatchRule && data.outFrom && data.returnTo && data.outFrom.trim() !== data.returnTo.trim()) risks.push("去程出发城市与返程到达城市不一致");
    if (state.settings.departureRule && data.outFrom && !state.settings.allowedCities.includes(data.outFrom.trim())) risks.push(`出发城市“${data.outFrom.trim()}”不在预设范围`);
    return risks;
  }

  async function init() {
    bindLogin();
    const config = window.APP_CONFIG || {};
    if (config.mode === "production" && config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
      backend = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      const { data } = await backend.auth.getSession();
      if (data.session) await loadBackendState();
      else if (!["portal", "lookup", "register"].includes((location.hash || "#dashboard").slice(1).split("?")[0])) $("#loginDialog").showModal();
    }
    populateUsers(); bindNavigation(); bindForms(); bindControls(); route(); renderAll();
    window.addEventListener("hashchange", route);
    window.addEventListener("scroll", () => $(".topbar")?.classList.toggle("scrolled", scrollY > 4));
    setTimeout(renderQr, 400);
  }

  function populateUsers() {
    const options = backend ? state.users.filter(u => u.id === state.currentUserId) : state.users;
    $("#userSelect").innerHTML = options.map(u => `<option value="${u.id}">${escapeHtml(u.name)} · ${escapeHtml(u.label)}</option>`).join("");
    $("#userSelect").value = state.currentUserId;
    $("#userSelect").disabled = !!backend;
  }

  function bindLogin() {
    $("#loginForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (!backend) return;
      const form = event.currentTarget;
      const { error } = await backend.auth.signInWithPassword({ email: form.elements.email.value, password: form.elements.password.value });
      if (error) { $("#loginError").textContent = "邮箱或密码不正确"; return; }
      $("#loginError").textContent = "";
      await loadBackendState();
      populateUsers(); renderAll(); $("#loginDialog").close(); toast("登录成功");
    });
  }

  async function loadBackendState() {
    const { data: authData } = await backend.auth.getUser();
    if (!authData.user) throw new Error("登录已过期");
    const { data: myProfile, error: profileError } = await backend.from("profiles").select("*").eq("user_id", authData.user.id).single();
    if (profileError) throw profileError;
    backendMeetingId = myProfile.meeting_id;
    const [meetingRes, profilesRes, attendeesRes, locksRes, noticesRes] = await Promise.all([
      backend.from("meetings").select("*").eq("id", backendMeetingId).single(),
      backend.from("profiles").select("*").eq("meeting_id", backendMeetingId),
      backend.from("attendees").select("*,transports(*)").eq("meeting_id", backendMeetingId).order("created_at", { ascending: false }),
      backend.from("column_locks").select("*").eq("meeting_id", backendMeetingId),
      backend.from("notifications").select("*").eq("meeting_id", backendMeetingId).order("created_at", { ascending: false }).limit(100),
    ]);
    for (const result of [meetingRes, profilesRes, attendeesRes, locksRes, noticesRes]) if (result.error) throw result.error;
    const meeting = meetingRes.data;
    state = {
      currentUserId: authData.user.id,
      users: profilesRes.data.map(p => ({ id: p.user_id, name: p.display_name, role: p.role, label: ({ops:"会务负责人",client:"会议负责人（客户）",sales:"销售负责人"})[p.role], phone: p.phone || "" })),
      settings: { eventName: meeting.name, deadline: meeting.deadline?.slice(0,16) || "", capacity: meeting.capacity, allowedCities: meeting.allowed_departure_cities || [], mismatchRule: meeting.check_city_mismatch, departureRule: meeting.check_departure_city },
      locks: { master: meeting.master_locked, columns: locksRes.data.filter(l => l.locked).map(l => l.field_group), rows: attendeesRes.data.filter(a => a.row_locked).map(a => a.id) },
      attendees: attendeesRes.data.map(fromDbAttendee),
      notifications: noticesRes.data.map(n => ({ id: n.id, type: n.type, text: n.message, time: n.created_at, read: !!n.read_at })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function fromDbAttendee(row) {
    const trip = direction => {
      const t = row.transports?.find(item => item.direction === direction) || {};
      return { driver: t.driver_name || "待分配", phone: t.driver_phone || "—", vehicle: t.vehicle || "待分配", time: t.service_time ? new Date(t.service_time).toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-") : "待设置", point: t.meeting_point || "待设置" };
    };
    return { id:row.id, attendeeType:row.attendee_type||"", name:row.name, city:row.city||"", hospital:row.hospital||"", department:row.department||"", title:row.title||"", venue:row.venue||"", sex:row.sex||"", idNumber:row.id_number, phone:row.phone, hcpId:row.hcp_id, accommodation:row.accommodation?"Y":"N", flight:row.is_flight?"Y":"N", region:row.region||"", mslContact:row.msl_contact||"", remarks:row.remarks||"", ownerId:row.owner_id, outDate:row.out_date||"", outFrom:row.out_from||"", outTo:row.out_to||"", outNo:row.out_no||"", outDeparture:(row.out_departure||"").slice(0,5), outArrival:(row.out_arrival||"").slice(0,5), returnDate:row.return_date||"", returnFrom:row.return_from||"", returnTo:row.return_to||"", returnNo:row.return_no||"", returnDeparture:(row.return_departure||"").slice(0,5), returnArrival:(row.return_arrival||"").slice(0,5), approval:row.approval, risks:row.risks||[], createdAt:row.created_at, transport:{pickup:trip("pickup"),dropoff:trip("dropoff")} };
  }

  function toDbAttendee(a) {
    return { id:a.id, meeting_id:backendMeetingId, owner_id:a.ownerId, attendee_type:a.attendeeType||null, name:a.name, city:a.city||null, hospital:a.hospital||null, department:a.department||null, title:a.title||null, venue:a.venue||null, sex:a.sex||null, id_number:a.idNumber, phone:a.phone, hcp_id:a.hcpId, accommodation:a.accommodation==="Y", is_flight:a.flight==="Y", out_date:a.outDate||null, out_from:a.outFrom||null, out_to:a.outTo||null, out_no:a.outNo||null, out_departure:a.outDeparture||null, out_arrival:a.outArrival||null, return_date:a.returnDate||null, return_from:a.returnFrom||null, return_to:a.returnTo||null, return_no:a.returnNo||null, return_departure:a.returnDeparture||null, return_arrival:a.returnArrival||null, region:a.region||null, msl_contact:a.mslContact||null, remarks:a.remarks||null, approval:a.approval, risks:a.risks||[], row_locked:state.locks.rows.includes(a.id) };
  }

  async function syncBackend() {
    if (!backend || !backendMeetingId) return;
    const attendeeRows = state.attendees.map(toDbAttendee);
    if (attendeeRows.length) { const { error } = await backend.from("attendees").upsert(attendeeRows); if (error) throw error; }
    const transportRows = state.attendees.flatMap(a => ["pickup","dropoff"].map(direction => { const t = a.transport?.[direction] || {}; return { attendee_id:a.id, direction, driver_name:t.driver||null, driver_phone:t.phone||null, vehicle:t.vehicle||null, service_time:parseServiceTime(t.time), meeting_point:t.point||null }; }));
    if (transportRows.length) { const { error } = await backend.from("transports").upsert(transportRows,{onConflict:"attendee_id,direction"}); if (error) throw error; }
    if (canManage()) {
      const { error } = await backend.from("meetings").update({ name:state.settings.eventName, deadline:state.settings.deadline||null, capacity:state.settings.capacity, allowed_departure_cities:state.settings.allowedCities, check_city_mismatch:state.settings.mismatchRule, check_departure_city:state.settings.departureRule, master_locked:state.locks.master }).eq("id",backendMeetingId); if (error) throw error;
      const lockRows = COLUMN_LOCKS.map(([field]) => ({ meeting_id:backendMeetingId, field_group:field, locked:state.locks.columns.includes(field), updated_by:state.currentUserId }));
      const lockResult = await backend.from("column_locks").upsert(lockRows); if (lockResult.error) throw lockResult.error;
    }
    toast("已同步到云端");
  }
  function parseServiceTime(value) { if (!value || value === "待设置") return null; const normalized = value.replace(/[年/.]/g,"-").replace(/月/g,"-").replace(/日/g,""); const date = new Date(normalized); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }

  function bindNavigation() {
    $("#menuButton").addEventListener("click", () => { $(".sidebar").classList.add("open"); $("#mobileOverlay").classList.add("show"); });
    $("#mobileOverlay").addEventListener("click", closeMenu);
    $$(".side-nav a").forEach(link => link.addEventListener("click", closeMenu));
    $("#notificationButton").addEventListener("click", () => location.hash = "notifications");
  }
  function closeMenu() { $(".sidebar").classList.remove("open"); $("#mobileOverlay").classList.remove("show"); }
  function route() {
    const target = (location.hash || "#dashboard").slice(1).split("?")[0];
    const isPublic = ["portal", "lookup", "register"].includes(target);
    $("#adminApp").classList.toggle("is-hidden", isPublic);
    $("#publicPortalView").classList.toggle("is-hidden", !isPublic);
    if (isPublic) { setPortalTab(target === "lookup" ? "lookup" : "register"); scrollTo({ top: 0, behavior: "instant" }); return; }
    const routeName = $( `[data-page="${target}"]`) ? target : "dashboard";
    $$(".page").forEach(page => page.classList.toggle("active", page.dataset.page === routeName));
    $$("[data-route]").forEach(link => link.classList.toggle("active", link.dataset.route === routeName));
    scrollTo({ top: 0, behavior: "instant" });
    renderAll();
  }

  function bindForms() {
    $("#registrationForm").addEventListener("input", updateLiveRisk);
    $("#registrationForm").addEventListener("submit", submitRegistration);
    $("#publicRegistrationForm").addEventListener("submit", submitPublicRegistration);
    $("#lookupForm").addEventListener("submit", queryTransport);
    $("#settingsForm").addEventListener("submit", saveSettings);
  }

  function bindControls() {
    $("#userSelect").addEventListener("change", event => { state.currentUserId = event.target.value; saveState(); renderAll(); toast(`已切换为${currentUser().label}`); });
    $("#attendeeSearch").addEventListener("input", renderAttendeeTable);
    $("#riskFilter").addEventListener("change", renderAttendeeTable);
    $("#venueFilter").addEventListener("change", renderAttendeeTable);
    $("#transportSearch").addEventListener("input", renderTransport);
    $$('[data-transport-filter]').forEach(button => button.addEventListener("click", () => { activeTransportFilter = button.dataset.transportFilter; $$('[data-transport-filter]').forEach(b => b.classList.toggle("active", b === button)); renderTransport(); }));
    $("#exportExcel").addEventListener("click", exportExcel);
    $("#markAllRead").addEventListener("click", async () => { state.notifications.forEach(n => n.read = true); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); if (backend && backendMeetingId) await backend.from("notifications").update({read_at:new Date().toISOString()}).eq("meeting_id",backendMeetingId).is("read_at",null); renderNotifications(); renderCounts(); });
    $("#masterLock").addEventListener("change", event => { if (!canManage()) return deny(); state.locks.master = event.target.checked; addNotification("lock", `${currentUser().name}${event.target.checked ? "锁定" : "解锁"}了全部名单`); saveState(); renderAll(); });
    $("#copyRegistrationLink").addEventListener("click", copyRegistrationLink);
    $("#downloadQr").addEventListener("click", downloadQr);
    $$('[data-portal-tab]').forEach(button => button.addEventListener("click", () => { location.hash = button.dataset.portalTab === "lookup" ? "lookup" : "portal"; }));
    $("#resetDemo").addEventListener("click", () => { if (!confirm("确认恢复全部演示数据？")) return; state = initialState(); saveState(); populateUsers(); renderAll(); toast("已恢复演示数据"); });
  }

  function setPortalTab(tab) {
    $$('[data-portal-tab]').forEach(button => {
      const active = button.dataset.portalTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $$('[data-portal-panel]').forEach(panel => panel.classList.toggle("is-hidden", panel.dataset.portalPanel !== tab));
  }

  function renderAll() {
    const user = currentUser();
    $("#greetingName").textContent = user.name;
    $("#userAvatar").textContent = user.name.slice(0, 1);
    renderRegistrationOwner(); renderCounts(); renderDashboard(); renderAttendeeTable(); renderApprovals(); renderTransport(); renderLocks(); renderNotifications(); renderSettings();
  }

  function renderRegistrationOwner() {
    const select = $("#registrationOwner");
    const sales = state.users.filter(user => user.role === "sales");
    const options = currentUser().role === "sales" ? [currentUser()] : sales.length ? sales : [currentUser()];
    select.innerHTML = options.map(user => `<option value="${user.id}">${escapeHtml(user.name)} · ${escapeHtml(user.label)}</option>`).join("");
    select.value = options.some(u => u.id === select.value) ? select.value : options[0]?.id;
  }

  function renderCounts() {
    const list = visibleAttendees();
    const pending = list.filter(a => a.approval === "pending").length;
    const unread = state.notifications.filter(n => !n.read).length;
    $("#navAttendeeCount").textContent = list.length;
    $("#navApprovalCount").textContent = pending || "";
    $("#navNoticeCount").textContent = unread || "";
    $("#topNoticeCount").textContent = unread;
  }

  function renderDashboard() {
    const list = visibleAttendees(); const pending = list.filter(a => a.approval === "pending").length;
    const assigned = list.filter(a => a.transport?.pickup?.driver && a.transport.pickup.driver !== "待分配").length;
    const metrics = [
      ["已报名人数", list.length, `名额 ${state.settings.capacity} 人`, "◎", "#dff1e5"],
      ["待审批行程", pending, pending ? "需要及时处理" : "全部处理完成", "△", "#fae3d8"],
      ["住宿需求", list.filter(a => a.accommodation === "Y").length, "已选择住宿", "⌂", "#e9e6f6"],
      ["已安排接送", assigned, `共 ${list.length} 位参会者`, "↗", "#f3e8c8"],
    ];
    $("#metricGrid").innerHTML = metrics.map(([label,value,note,icon,tint]) => `<article class="metric-card" style="--metric-tint:${tint}"><p>${label}</p><strong>${value}</strong><small>${note}</small><span>${icon}</span></article>`).join("");
    $("#progressCount").textContent = list.length; const percent = Math.min(100, Math.round(list.length / state.settings.capacity * 100));
    $("#progressBar").style.width = `${percent}%`; $("#progressPercent").textContent = `${percent}%`;
    const cityCounts = Object.entries(list.reduce((acc,a) => (acc[a.city] = (acc[a.city] || 0) + 1, acc), {})).sort((a,b) => b[1] - a[1]).slice(0,4);
    const max = Math.max(...cityCounts.map(([,v]) => v), 1); const colors = ["#2e7757", "#779c7b", "#c79645", "#8b83ad"];
    $("#cityBars").innerHTML = cityCounts.map(([city,count],i) => `<div class="city-bar"><span>${escapeHtml(city)}</span><div><i style="width:${count/max*100}%;--bar-color:${colors[i]}"></i></div><strong>${count}</strong></div>`).join("") || `<div class="empty-state">暂无报名</div>`;
    const risks = list.filter(a => a.approval === "pending").slice(0,3);
    $("#attentionList").innerHTML = risks.length ? risks.map(a => `<div class="attention-item"><span class="attention-icon">△</span><div><strong>${escapeHtml(a.name)} · ${escapeHtml(a.risks[0] || "异常行程")}</strong><small>${escapeHtml(a.outFrom)} → ${escapeHtml(a.outTo)} / ${escapeHtml(a.returnFrom)} → ${escapeHtml(a.returnTo)}</small></div><button data-open-attendee="${a.id}">处理 →</button></div>`).join("") : `<div class="empty-state">暂无待处理事项</div>`;
    $("#recentTimeline").innerHTML = state.notifications.slice(0,4).map(n => `<div class="timeline-item"><p>${escapeHtml(n.text)}</p><small>${relativeTime(n.time)}</small></div>`).join("");
    bindDynamicButtons();
  }

  function getFilteredAttendees() {
    const query = $("#attendeeSearch").value.trim().toLowerCase(); const risk = $("#riskFilter").value; const venue = $("#venueFilter").value;
    return visibleAttendees().filter(a => {
      const haystack = [a.name,a.city,a.hospital,a.department,a.outNo,a.returnNo].join(" ").toLowerCase();
      return (!query || haystack.includes(query)) && (risk === "all" || a.approval === risk) && (venue === "all" || a.venue === venue);
    });
  }
  function renderAttendeeTable() {
    const list = getFilteredAttendees();
    $("#rosterScope").textContent = currentUser().role === "sales" ? `仅显示 ${currentUser().name} 负责的参会者。` : "显示本会议全部参会者。";
    $("#attendeeTableBody").innerHTML = list.map(a => `<tr><td><div class="person-cell"><span class="person-avatar">${escapeHtml(a.name[0])}</span><div><span class="cell-primary">${escapeHtml(a.name)}</span><span class="cell-secondary">${escapeHtml(a.phone.slice(0,3))}****${escapeHtml(a.phone.slice(-4))}</span></div></div></td><td><span class="cell-primary">${escapeHtml(a.hospital)}</span><span class="cell-secondary">${escapeHtml(a.department)} · ${escapeHtml(a.title)}</span></td><td>${escapeHtml(a.venue)}</td><td><span class="cell-primary">${escapeHtml(a.outNo)}</span><span class="cell-secondary">${fmtDate(a.outDate)} ${escapeHtml(a.outFrom)} → ${escapeHtml(a.outTo)}</span></td><td><span class="cell-primary">${escapeHtml(a.returnNo)}</span><span class="cell-secondary">${fmtDate(a.returnDate)} ${escapeHtml(a.returnFrom)} → ${escapeHtml(a.returnTo)}</span></td><td>${escapeHtml(userName(a.ownerId))}</td><td><span class="status status-${isLocked(a) ? "locked" : a.approval}">${isLocked(a) ? "已锁定" : approvalLabel(a.approval)}</span></td><td><button class="row-action" data-open-attendee="${a.id}" aria-label="查看详情">•••</button></td></tr>`).join("");
    $("#attendeeEmpty").classList.toggle("is-hidden", !!list.length); bindDynamicButtons();
  }

  function renderApprovals() {
    const list = visibleAttendees().filter(a => a.approval === "pending");
    $("#approvalBoard").innerHTML = list.length ? list.map(a => `<article class="panel approval-card"><span class="status status-pending">待审批</span><h3>${escapeHtml(a.name)}</h3><div class="approval-meta">${escapeHtml(a.hospital)} · 负责人 ${escapeHtml(userName(a.ownerId))}</div><div class="risk-list">${a.risks.map(r => `<div class="risk-item">△ ${escapeHtml(r)}</div>`).join("")}</div><div class="route-line"><div><small>去程出发</small><strong>${escapeHtml(a.outFrom)}</strong></div><span>→</span><div><small>返程到达</small><strong>${escapeHtml(a.returnTo)}</strong></div></div><div class="approval-actions"><button class="button button-secondary" data-reject="${a.id}" ${canManage() ? "" : "disabled"}>退回修改</button><button class="button button-primary" data-approve="${a.id}" ${canManage() ? "" : "disabled"}>通过</button></div></article>`).join("") : `<article class="panel empty-state" style="grid-column:1/-1">没有待审批的异常行程</article>`;
    bindDynamicButtons();
  }

  function renderTransport() {
    const query = $("#transportSearch").value.trim().toLowerCase();
    const list = visibleAttendees().filter(a => !query || [a.name,a.outNo,a.returnNo].join(" ").toLowerCase().includes(query));
    const cards = [];
    list.forEach(a => {
      ["pickup","dropoff"].forEach(type => {
        if (activeTransportFilter !== "all" && activeTransportFilter !== type) return;
        const item = a.transport?.[type] || {};
        const staff = isStaffTransport(item);
        const assigned = item.driver && item.driver !== "待分配";
        const contact = staff ? "会务工作人员现场接待" : `${item.driver || "待分配"} · ${item.phone || "—"}`;
        const vehicle = staff ? "无需录入司机 / 车辆" : (item.vehicle || "待分配");
        cards.push(`<article class="transport-card"><div class="transport-head"><div><h3>${escapeHtml(a.name)} · ${type === "pickup" ? "接机" : "送机"}</h3><p>${escapeHtml(type === "pickup" ? `${a.outNo} · ${a.outArrival} 到达` : `${a.returnNo} · ${a.returnDeparture} 出发`)}</p></div><span class="status ${assigned ? "status-normal" : "status-pending"}">${assigned ? (staff ? "工作人员接待" : "独立司机") : "待分配"}</span></div><div class="transport-details"><div><small>接送方式</small><strong>${escapeHtml(contact)}</strong></div><div><small>车辆</small><strong>${escapeHtml(vehicle)}</strong></div><div><small>时间</small><strong>${escapeHtml(item.time || "待设置")}</strong></div><div><small>集合点</small><strong>${escapeHtml(item.point || "待设置")}</strong></div></div>${type === "dropoff" ? `<div class="transport-rule">${isFlightReturn(a) ? "航班起飞前 2 小时" : "高铁出发前 1.5 小时"} · 建议 ${escapeHtml(recommendedDropoffTime(a) || "待补全返程时间")}</div>` : ""}${canManage() ? `<button class="transport-edit" data-edit-transport="${a.id}" data-type="${type}">编辑安排 →</button>` : ""}</article>`);
      });
    });
    $("#transportGrid").innerHTML = cards.join("") || `<div class="empty-state">暂无接送机记录</div>`; bindDynamicButtons();
  }

  function renderLocks() {
    $("#masterLock").checked = state.locks.master; $("#masterLock").disabled = !canManage();
    $("#columnLocks").innerHTML = COLUMN_LOCKS.map(([key,label]) => `<label class="lock-chip"><input type="checkbox" data-column-lock="${key}" ${state.locks.columns.includes(key) ? "checked" : ""} ${canManage() ? "" : "disabled"}/> ${label}</label>`).join("");
    $("#rowLocks").innerHTML = visibleAttendees().map(a => `<div class="row-lock-item"><span class="person-avatar">${escapeHtml(a.name[0])}</span><p><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.hospital)} · ${escapeHtml(userName(a.ownerId))}</small></p><label class="switch"><input type="checkbox" data-row-lock="${a.id}" ${state.locks.rows.includes(a.id) ? "checked" : ""} ${canManage() ? "" : "disabled"}/><span></span></label></div>`).join("");
    $$('[data-column-lock]').forEach(input => input.addEventListener("change", () => toggleArrayValue(state.locks.columns, input.dataset.columnLock, input.checked, "列锁定规则")));
    $$('[data-row-lock]').forEach(input => input.addEventListener("change", () => toggleArrayValue(state.locks.rows, input.dataset.rowLock, input.checked, `${state.attendees.find(a => a.id === input.dataset.rowLock)?.name}的报名信息`)));
  }
  function toggleArrayValue(array, value, checked, label) {
    if (checked && !array.includes(value)) array.push(value); if (!checked) array.splice(array.indexOf(value), 1);
    addNotification("lock", `${currentUser().name}${checked ? "锁定" : "解锁"}了${label}`); saveState(); renderAll();
  }

  function renderNotifications() {
    const icons = { change: "↻", approval: "✓", lock: "▣", create: "+" };
    $("#notificationList").innerHTML = state.notifications.length ? state.notifications.map(n => `<div class="notification-item ${n.read ? "" : "unread"}"><span class="notice-icon">${icons[n.type] || "◌"}</span><p>${escapeHtml(n.text)}</p><small>${relativeTime(n.time)}</small></div>`).join("") : `<div class="empty-state">暂无变更记录</div>`;
  }
  function renderSettings() {
    const form = $("#settingsForm"); form.elements.eventName.value = state.settings.eventName; form.elements.deadline.value = state.settings.deadline; form.elements.capacity.value = state.settings.capacity; form.elements.allowedCities.value = state.settings.allowedCities.join("、"); form.elements.mismatchRule.checked = state.settings.mismatchRule; form.elements.departureRule.checked = state.settings.departureRule;
    $$('input,textarea,button[type="submit"]', form).forEach(input => input.disabled = !canManage() && input.id !== "resetDemo");
    $("#resetDemo").classList.toggle("is-hidden", !!backend);
  }

  function bindDynamicButtons() {
    $$('[data-open-attendee]').forEach(button => button.onclick = () => openAttendee(button.dataset.openAttendee));
    $$('[data-approve]').forEach(button => button.onclick = () => approveAttendee(button.dataset.approve));
    $$('[data-reject]').forEach(button => button.onclick = () => rejectAttendee(button.dataset.reject));
    $$('[data-edit-transport]').forEach(button => button.onclick = () => editTransport(button.dataset.editTransport, button.dataset.type));
  }

  function openAttendee(id) {
    const a = state.attendees.find(item => item.id === id); if (!a) return;
    const locked = isLocked(a); const canEdit = !locked && (canManage() || a.ownerId === currentUser().id);
    $("#attendeeDetail").innerHTML = `<div class="detail-head"><span class="kicker" style="color:#b9ddc5">ATTENDEE DETAIL</span><h2>${escapeHtml(a.name)}</h2><p>${escapeHtml(a.hospital)} · ${escapeHtml(a.department)} · ${escapeHtml(userName(a.ownerId))}负责</p></div><div class="detail-body"><div class="detail-grid"><div class="detail-block"><small>手机号</small><strong>${escapeHtml(a.phone)}</strong></div><div class="detail-block"><small>客户编号</small><strong>${escapeHtml(a.hcpId)}</strong></div><div class="detail-block"><small>去程</small><strong>${escapeHtml(a.outNo)} · ${fmtDate(a.outDate)} ${escapeHtml(a.outDeparture)}</strong></div><div class="detail-block"><small>返程</small><strong>${escapeHtml(a.returnNo)} · ${fmtDate(a.returnDate)} ${escapeHtml(a.returnDeparture)}</strong></div><div class="detail-block"><small>去程路线</small><strong>${escapeHtml(a.outFrom)} → ${escapeHtml(a.outTo)}</strong></div><div class="detail-block"><small>返程路线</small><strong>${escapeHtml(a.returnFrom)} → ${escapeHtml(a.returnTo)}</strong></div></div>${a.risks.length ? `<div class="risk-preview warning">${a.risks.map(r => `△ ${escapeHtml(r)}`).join("<br>")}</div>` : `<div class="risk-preview ok">✓ 当前行程符合预设规则</div>`}<div class="detail-actions">${canEdit ? `<button class="button button-primary" id="editTripButton">修改行程</button>` : `<span class="status status-locked">${locked ? "名单已锁定" : "无修改权限"}</span>`}<button class="button button-secondary" id="closeDetailButton">关闭</button></div></div>`;
    const dialog = $("#attendeeDialog"); dialog.showModal(); $("#closeDetailButton").onclick = () => dialog.close(); if (canEdit) $("#editTripButton").onclick = () => showTripEditor(a);
  }

  function showTripEditor(a) {
    $("#attendeeDetail").innerHTML = `<div class="detail-head"><span class="kicker" style="color:#b9ddc5">EDIT TRAVEL</span><h2>修改 ${escapeHtml(a.name)} 的行程</h2><p>保存后会生成变更提醒并重新检查审批规则</p></div><form class="detail-body" id="tripEditForm"><div class="field-grid"><label>去程出发城市<input name="outFrom" value="${escapeHtml(a.outFrom)}" required></label><label>去程到达城市<input name="outTo" value="${escapeHtml(a.outTo)}" required></label><label>去程航班 / 车次<input name="outNo" value="${escapeHtml(a.outNo)}" required></label><label>去程出发时间<input name="outDeparture" type="time" value="${escapeHtml(a.outDeparture)}" required></label><label>返程出发城市<input name="returnFrom" value="${escapeHtml(a.returnFrom)}" required></label><label>返程到达城市<input name="returnTo" value="${escapeHtml(a.returnTo)}" required></label><label>返程航班 / 车次<input name="returnNo" value="${escapeHtml(a.returnNo)}" required></label><label>返程出发时间<input name="returnDeparture" type="time" value="${escapeHtml(a.returnDeparture)}" required></label></div><div class="detail-actions"><button class="button button-primary" type="submit">保存变更</button><button class="button button-secondary" type="button" id="cancelEdit">取消</button></div></form>`;
    $("#cancelEdit").onclick = () => openAttendee(a.id);
    $("#tripEditForm").onsubmit = event => {
      event.preventDefault(); const fd = new FormData(event.currentTarget); const changes = []; ["outFrom","outTo","outNo","outDeparture","returnFrom","returnTo","returnNo","returnDeparture"].forEach(key => { const next = fd.get(key); if (next !== a[key]) { changes.push(`${key}: ${a[key]} → ${next}`); a[key] = next; } });
      a.risks = evaluateRisks(a); a.approval = a.risks.length ? "pending" : "normal"; addNotification("change", `${currentUser().name}修改了${a.name}的行程：${changes.join("；")}`); saveState(); $("#attendeeDialog").close(); renderAll(); toast("行程已更新，会务负责人已收到变更提醒");
    };
  }

  function approveAttendee(id) { if (!canManage()) return deny(); const a = state.attendees.find(item => item.id === id); a.approval = "approved"; a.risks = []; addNotification("approval", `${a.name}的异常行程已由${currentUser().name}审批通过`); saveState(); renderAll(); toast("行程已审批通过"); }
  function rejectAttendee(id) { if (!canManage()) return deny(); const a = state.attendees.find(item => item.id === id); addNotification("approval", `${currentUser().name}退回了${a.name}的异常行程，请负责人修改`); saveState(); renderAll(); toast("已退回负责人修改"); }
  function deny() { toast("当前身份没有此操作权限", "error"); renderAll(); }

  function editTransport(id, type) {
    const a = state.attendees.find(item => item.id === id); const t = a.transport[type] || {}; const typeName = type === "pickup" ? "接机" : "送机";
    const suggested = type === "dropoff" ? recommendedDropoffTime(a) : "";
    const savedTime = !t.time || ["待设置","待分配"].includes(t.time) ? suggested : t.time;
    const currentMode = isStaffTransport(t) ? "staff" : "driver";
    $("#attendeeDetail").innerHTML = `<div class="detail-head"><span class="kicker" style="color:#b9ddc5">TRANSPORT</span><h2>${escapeHtml(a.name)} · ${typeName}</h2><p>更新后参会者可在公开查询端立即查看</p></div><form class="detail-body" id="transportEditForm"><div class="field-grid"><label class="span-2">接送方式<select name="mode" id="transportMode"><option value="staff" ${currentMode === "staff" ? "selected" : ""}>机场 / 车站工作人员接待</option><option value="driver" ${currentMode === "driver" ? "selected" : ""}>独立司机接送</option></select></label><div class="span-2 driver-fields" id="driverFields"><div class="field-grid"><label>司机姓名<input name="driver" value="${escapeHtml(currentMode === "driver" ? t.driver || "" : "")}"></label><label>司机电话<input name="phone" value="${escapeHtml(currentMode === "driver" ? t.phone || "" : "")}"></label><label class="span-2">车辆 / 车牌<input name="vehicle" value="${escapeHtml(currentMode === "driver" ? t.vehicle || "" : "")}"></label></div></div><label>接送时间<input name="time" value="${escapeHtml(savedTime || "")}" placeholder="YYYY-MM-DD HH:mm" required></label><label>集合点<input name="point" value="${escapeHtml(t.point || "")}" required></label></div>${type === "dropoff" ? `<div class="risk-preview ok">✓ 自动建议：${isFlightReturn(a) ? "机场按航班起飞前 2 小时" : "高铁站按列车出发前 1.5 小时"}，当前建议 ${escapeHtml(suggested || "请先补全返程日期与时间")}；可按城市路况手动调整。</div>` : `<div class="risk-preview">工作人员接待时，无需录入司机、电话和车辆。</div>`}<div class="detail-actions"><button class="button button-primary" type="submit">保存安排</button><button class="button button-secondary" type="button" id="cancelTransport">取消</button></div></form>`;
    const dialog = $("#attendeeDialog"); dialog.showModal();
    const form = $("#transportEditForm"); const mode = $("#transportMode"); const driverFields = $("#driverFields");
    const toggleDriverFields = () => { const show = mode.value === "driver"; driverFields.classList.toggle("is-hidden", !show); $$('input', driverFields).forEach(input => input.required = show); };
    mode.onchange = toggleDriverFields; toggleDriverFields(); $("#cancelTransport").onclick = () => dialog.close();
    form.onsubmit = event => { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); a.transport[type] = values.mode === "staff" ? { driver:"会务工作人员", phone:"", vehicle:"", time:values.time, point:values.point } : { driver:values.driver, phone:values.phone, vehicle:values.vehicle, time:values.time, point:values.point }; addNotification("change", `${currentUser().name}更新了${a.name}的${typeName}安排`); saveState(); dialog.close(); renderAll(); toast(`${typeName}安排已更新`); };
  }

  function isStaffTransport(item = {}) { return item.driver === "会务工作人员"; }
  function isFlightReturn(a) { return a.flight === "Y" && !/^[GDC]\d+/i.test(String(a.returnNo || "").trim()); }
  function recommendedDropoffTime(a) {
    if (!a.returnDate || !a.returnDeparture) return "";
    const departure = new Date(`${a.returnDate}T${a.returnDeparture}:00`);
    if (Number.isNaN(departure.getTime())) return "";
    departure.setMinutes(departure.getMinutes() - (isFlightReturn(a) ? 120 : 90));
    const pad = value => String(value).padStart(2,"0");
    return `${departure.getFullYear()}-${pad(departure.getMonth()+1)}-${pad(departure.getDate())} ${pad(departure.getHours())}:${pad(departure.getMinutes())}`;
  }

  function updateLiveRisk() {
    const data = Object.fromEntries(new FormData($("#registrationForm"))); const risks = evaluateRisks(data); const box = $("#liveRisk"); box.className = `risk-preview ${risks.length ? "warning" : data.outFrom && data.returnTo ? "ok" : ""}`; box.innerHTML = risks.length ? risks.map(r => `△ ${escapeHtml(r)}`).join("<br>") : data.outFrom && data.returnTo ? "✓ 当前行程符合预设规则" : "填写行程后显示检查结果";
  }

  function submitRegistration(event) {
    event.preventDefault(); if (state.locks.master) return toast("全名单已锁定，不能新增报名", "error");
    const data = Object.fromEntries(new FormData(event.currentTarget)); data.phone = normalizePhone(data.phone); if (data.phone.length !== 11) return toast("请输入正确的 11 位手机号", "error");
    if (state.attendees.some(a => a.phone === data.phone)) return toast("该手机号已存在报名记录", "error");
    data.id = backend ? crypto.randomUUID() : `a-${Date.now()}`; data.ownerId = currentUser().role === "sales" ? currentUser().id : (data.ownerId || state.users.find(u => u.role === "sales")?.id || currentUser().id); data.risks = evaluateRisks(data); data.approval = data.risks.length ? "pending" : "normal"; data.createdAt = new Date().toISOString(); data.transport = { pickup: { driver: "待分配", phone: "—", vehicle: "待分配", time: `${data.outDate} ${data.outArrival}`, point: `${data.outTo}到达口` }, dropoff: { driver: "待分配", phone: "—", vehicle: "待分配", time: recommendedDropoffTime(data), point: "会议酒店大堂" } };
    state.attendees.unshift(data); addNotification("create", `${currentUser().name}新增报名：${data.name} · ${data.venue}${data.risks.length ? "（行程待审批）" : ""}`); saveState(); event.currentTarget.reset(); renderAll(); toast(data.risks.length ? "报名已保存，异常行程已提交审批" : "报名已保存"); location.hash = "attendees";
  }

  async function submitPublicRegistration(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = $("#publicRegistrationResult");
    const submit = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    const phone = normalizePhone(data.phone);
    if (phone.length !== 11) { result.innerHTML = `<div class="lookup-error">请输入正确的 11 位手机号。</div>`; return; }
    if (!window.APP_CONFIG?.supabaseUrl) { result.innerHTML = `<div class="lookup-error">报名服务暂不可用，请联系会务负责人。</div>`; return; }
    submit.disabled = true; submit.textContent = "正在提交…";
    try {
      const response = await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`, {
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey},
        body:JSON.stringify({action:"register",meeting:window.APP_CONFIG.eventSlug,region:data.region,name:data.name,phone}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "提交失败");
      result.innerHTML = `<div class="lookup-success"><strong>✓ 报名已提交</strong><br />会务负责人将通过手机号与你确认后续行程。</div>`;
      form.reset();
    } catch (error) { result.innerHTML = `<div class="lookup-error">${escapeHtml(error.message)}</div>`; }
    finally { submit.disabled = false; submit.innerHTML = `提交报名 <span>→</span>`; }
  }

  async function queryTransport(event) {
    event.preventDefault(); const phone = normalizePhone($("#lookupPhone").value); const result = $("#lookupResult");
    if (phone.length !== 11) { result.innerHTML = `<div class="lookup-error">请输入正确的 11 位手机号</div>`; return; }
    lastLookupSchedule = null;
    if (window.APP_CONFIG?.mode === "production" && window.APP_CONFIG.supabaseUrl) {
      try {
        const response = await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`, { method:"POST", headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey}, body:JSON.stringify({phone,meeting:window.APP_CONFIG.eventSlug}) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "查询失败");
        if (!payload.found) { result.innerHTML = `<div class="lookup-error">未查询到该手机号的行程，请确认号码或联系会务服务台。</div>`; return; }
        const pickup = payload.transports?.find(item => item.direction === "pickup") || {};
        const dropoff = payload.transports?.find(item => item.direction === "dropoff") || {};
        result.innerHTML = renderLookupResult(payload.attendee.name, payload.outbound, payload.returnTrip, pickup, dropoff);
        lastLookupSchedule = buildLookupSchedule(payload.attendee.name, pickup, dropoff);
        $("#addCalendarButton")?.addEventListener("click", downloadCalendar);
      } catch (error) { result.innerHTML = `<div class="lookup-error">${escapeHtml(error.message)}</div>`; }
      return;
    }
    const a = state.attendees.find(item => normalizePhone(item.phone) === phone);
    if (!a) { result.innerHTML = `<div class="lookup-error">未查询到该手机号的行程，请确认号码或联系会务服务台。</div>`; return; }
    const outbound = { number:a.outNo, from:a.outFrom, to:a.outTo, date:`${a.outDate} ${a.outArrival} 到达` };
    const returnTrip = { number:a.returnNo, from:a.returnFrom, to:a.returnTo, date:`${a.returnDate} ${a.returnDeparture} 出发` };
    const pickup = a.transport?.pickup || {}; const dropoff = a.transport?.dropoff || {};
    result.innerHTML = renderLookupResult(maskName(a.name), outbound, returnTrip, pickup, dropoff);
    lastLookupSchedule = buildLookupSchedule(a.name, pickup, dropoff);
    $("#addCalendarButton")?.addEventListener("click", downloadCalendar);
  }

  function renderLookupResult(name, outbound = {}, returnTrip = {}, pickup = {}, dropoff = {}) {
    const displayTime = value => { if (!value) return "待公布"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("zh-CN",{hour12:false}); };
    const card = (label, trip, t) => {
      const staff = isStaffTransport({driver:t.driver || t.driver_name});
      const driver = staff ? "会务工作人员现场接待" : `${t.driver || t.driver_name || "待分配"} · ${t.phone || t.driver_phone || "—"}`;
      const vehicle = staff ? "无需司机及车辆信息" : (t.vehicle || "待分配");
      return `<div class="result-card"><h3>${label} · ${escapeHtml(trip.number||"待公布")}</h3><p>${escapeHtml(trip.from||"")} → ${escapeHtml(trip.to||"")} · ${escapeHtml(trip.date||"")}</p><div class="result-route"><div><small>接送方式</small><strong>${escapeHtml(driver)}</strong></div><div><small>车辆</small><strong>${escapeHtml(vehicle)}</strong></div><div><small>${label}时间</small><strong>${escapeHtml(displayTime(t.time || t.service_time))}</strong></div><div><small>集合点</small><strong>${escapeHtml(t.point || t.meeting_point || "待公布")}</strong></div></div></div>`;
    };
    return `<div class="lookup-name">${escapeHtml(name)}，你的安排如下</div>${card("接机",outbound,pickup)}${card("送机",returnTrip,dropoff)}<button class="button button-primary button-block calendar-button" id="addCalendarButton" type="button">添加到手机日历并自动提醒</button><p class="calendar-hint">添加后，手机将在每次接送前 30 分钟提醒；无需短信或额外 App。</p>`;
  }

  function buildLookupSchedule(name, pickup = {}, dropoff = {}) {
    const event = (label, t) => ({ title:`HEMA SEM ${label}提醒`, time:t.time || t.service_time || "", location:t.point || t.meeting_point || "", description:isStaffTransport({driver:t.driver || t.driver_name}) ? "会务工作人员现场接待" : `司机：${t.driver || t.driver_name || "待分配"}；电话：${t.phone || t.driver_phone || "—"}；车辆：${t.vehicle || "待分配"}` });
    return { name, events:[event("接机",pickup),event("送机",dropoff)].filter(item => item.time && !["待设置","待公布","待分配"].includes(item.time)) };
  }

  function downloadCalendar() {
    if (!lastLookupSchedule?.events.length) return toast("接送时间尚未公布，暂时无法添加提醒", "error");
    const icsDate = value => { const date = new Date(String(value).replace(" ","T")); if (Number.isNaN(date.getTime())) return ""; return `${date.getUTCFullYear()}${String(date.getUTCMonth()+1).padStart(2,"0")}${String(date.getUTCDate()).padStart(2,"0")}T${String(date.getUTCHours()).padStart(2,"0")}${String(date.getUTCMinutes()).padStart(2,"0")}00Z`; };
    const escapeIcs = value => String(value || "").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
    const stamp = icsDate(new Date().toISOString());
    const events = lastLookupSchedule.events.map((item,index) => { const start = icsDate(item.time); const endDate = new Date(String(item.time).replace(" ","T")); endDate.setMinutes(endDate.getMinutes()+30); return [`BEGIN:VEVENT`,`UID:${Date.now()}-${index}@journey-desk`,`DTSTAMP:${stamp}`,`DTSTART:${start}`,`DTEND:${icsDate(endDate.toISOString())}`,`SUMMARY:${escapeIcs(item.title)}`,`LOCATION:${escapeIcs(item.location)}`,`DESCRIPTION:${escapeIcs(item.description)}`,`BEGIN:VALARM`,`TRIGGER:-PT30M`,`ACTION:DISPLAY`,`DESCRIPTION:${escapeIcs(item.title)}`,`END:VALARM`,`END:VEVENT`].join("\r\n"); }).filter(item => !item.includes("DTSTART:\r\n"));
    const content = [`BEGIN:VCALENDAR`,`VERSION:2.0`,`PRODID:-//Journey Desk//HEMA SEM//CN`,`CALSCALE:GREGORIAN`,...events,`END:VCALENDAR`].join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content],{type:"text/calendar;charset=utf-8"})); link.download = `HEMA-SEM-${lastLookupSchedule.name}-接送提醒.ics`; link.click(); URL.revokeObjectURL(link.href); toast("日历提醒已生成，请选择添加到手机日历");
  }

  function saveSettings(event) {
    event.preventDefault(); if (!canManage()) return deny(); const data = Object.fromEntries(new FormData(event.currentTarget)); state.settings.eventName = data.eventName; state.settings.deadline = data.deadline; state.settings.capacity = Number(data.capacity) || 120; state.settings.allowedCities = data.allowedCities.split(/[、,，\s]+/).map(v => v.trim()).filter(Boolean); state.settings.mismatchRule = !!data.mismatchRule; state.settings.departureRule = !!data.departureRule; addNotification("change", `${currentUser().name}更新了会议和行程预警设置`); saveState(); renderAll(); toast("会议设置已保存");
  }

  function copyRegistrationLink() { const url = `${location.origin}${location.pathname}#portal`; navigator.clipboard?.writeText(url).then(() => toast("参会服务链接已复制")).catch(() => toast(url)); }
  function renderQr() { const box = $("#qrCanvas"); if (!box) return; const url = `${location.origin}${location.pathname}#portal`; box.innerHTML = ""; if (window.QRCode) new QRCode(box, { text:url, width:256, height:256, colorDark:"#000000", colorLight:"#ffffff", correctLevel:QRCode.CorrectLevel.M }); else box.innerHTML = `<button class="text-button" type="button">复制参会服务链接</button>`; box.querySelector("button")?.addEventListener("click",copyRegistrationLink); }
  function downloadQr() {
    const source = $("#qrCanvas canvas") || $("#qrCanvas img");
    if (!source) return copyRegistrationLink();
    const output = document.createElement("canvas");
    output.width = 320; output.height = 320;
    const context = output.getContext("2d");
    context.fillStyle = "#ffffff"; context.fillRect(0,0,320,320);
    context.imageSmoothingEnabled = false;
    context.drawImage(source,32,32,256,256);
    const link = document.createElement("a");
    link.download = "HEMA-SEM-参会服务二维码.png";
    link.href = output.toDataURL("image/png");
    link.click();
  }

  function exportExcel() {
    const headers = ["No.\n序号","Attendee Type\n参会者类别","Name\n客户姓名(姓/名)*","City\n城市","Hospital/Chain\n医院/连锁","Department/Store\n科室/门店","Title\n职称","会场\n（多城会议）","Sex\n性别","ID/Passpor No.*\n身份证号/护照号*","Mobile Phone #\n手机号","HCP ID*\n客户编号*","Accommodation\n住宿安排(Y/N)","Flight\n是否航空(Y/N)","Departure Date\n出发日期","Departure City 出发城市","Arrival City 到达城市","Flight/Train No.\n航班/车次号","Departure time 出发时间","Arrival time 到达时间","Return Date\n返回日期","Departure City 出发城市","Arrival City 到达城市","Flight/Train No.\n航班/车次号","Departure time 出发时间","Arrival time 到达时间","Region\n大区","Contact Name\n销售联系人姓名","Contact Mobile\n销售联系人手机","MSL医学部联系人","Remarks\n备注（本地客户/VIP异地用车备注）"];
    const rows = visibleAttendees().map((a,i) => [i+1,a.attendeeType,a.name,a.city,a.hospital,a.department,a.title,a.venue,a.sex,a.idNumber,a.phone,a.hcpId,a.accommodation,a.flight,a.outDate,a.outFrom,a.outTo,a.outNo,a.outDeparture,a.outArrival,a.returnDate,a.returnFrom,a.returnTo,a.returnNo,a.returnDeparture,a.returnArrival,a.region,userName(a.ownerId),state.users.find(u=>u.id===a.ownerId)?.phone || "",a.mslContact,a.remarks]);
    if (window.XLSX) { const ws = XLSX.utils.aoa_to_sheet([headers,...rows]); ws["!cols"] = headers.map((_,i) => ({ wch: i === 0 ? 7 : i >= 14 && i <= 25 ? 14 : 18 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"报名表"); XLSX.writeFile(wb,`HEMA-SEM-报名表-${new Date().toISOString().slice(0,10)}.xlsx`); toast("Excel 已导出"); }
    else { const csv = [headers,...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv"})); link.download = "HEMA-SEM-报名表.csv"; link.click(); toast("已导出兼容 Excel 的 CSV 文件"); }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
