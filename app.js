(() => {
  "use strict";

  const STORAGE_KEY = "journey-desk-state-v1";
  const COLUMN_LOCKS = [
    ["identity", "身份与证件"], ["contact", "手机号"], ["outbound", "去程"],
    ["return", "返程"], ["accommodation", "住宿"], ["transport", "接送机"], ["remarks", "备注"],
  ];

  const initialState = () => ({
    currentUserId: "u-ops",
    activeProjectId: "demo-hema",
    projects: [{ id:"demo-hema", slug:"hema-sem-2026", name:"HEMA SEM · 大连 & 福州", clientName:"礼来", role:"ops", attendeeCount:5, startDate:"2026-09-04", endDate:"2026-09-12", brandColor:"#5267d9" }],
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
      slug: "hema-sem-2026",
      clientName: "礼来",
      startDate: "2026-09-04",
      endDate: "2026-09-12",
      venues: ["大连会场", "福州会场"],
      servicePhone: "",
      brandColor: "#5267d9",
      flightLeadMinutes: 120,
      trainLeadMinutes: 90,
      fieldConfig: { title:true, hcpId:true, accommodation:true, flight:true, mslContact:true, remarks:true },
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
  let publicAuthSession = null;
  let publicProjectConfig = null;
  let projectMemberships = [];
  let pendingImportRows = [];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const normalizePhone = value => String(value || "").replace(/\D/g, "").slice(-11);
  const currentUser = () => state.users.find(user => user.id === state.currentUserId) || state.users[0];
  const userName = id => state.users.find(user => user.id === id)?.name || "未分配";
  const visibleAttendees = () => currentUser().role === "sales" ? state.attendees.filter(item => item.ownerId === currentUser().id) : state.attendees;
  const canManage = () => ["ops", "client"].includes(currentUser().role);
  const isLocked = attendee => state.locks.master || state.locks.rows.includes(attendee.id);
  const currentProject = () => state.projects.find(project => project.id === state.activeProjectId) || state.projects[0] || {};
  const currentEventSlug = () => new URLSearchParams(location.search).get("event") || state.settings.slug || window.APP_CONFIG?.eventSlug || "";
  const publicProjectUrl = (hash = "portal") => {
    const url = new URL(location.href);
    url.searchParams.set("event", currentProject().slug || state.settings.slug || currentEventSlug());
    url.hash = hash;
    return url.toString();
  };
  const projectVisual = project => {
    const icons = ["✦","◈","✚","◎","⌁","◇","✺","⬡"];
    const colors = ["#5267d9","#b665d6","#e47a52","#d49a28","#3e8fc6","#d45672","#7b68c8","#516f9b"];
    const seed = [...String(project?.slug || project?.name || "project")].reduce((sum,char)=>sum+char.charCodeAt(0),0);
    return { icon:icons[seed%icons.length], color:colors[seed%colors.length] };
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved?.attendees) return initialState();
      const defaults = initialState();
      return { ...defaults, ...saved, settings:{...defaults.settings,...saved.settings}, projects:saved.projects?.length ? saved.projects : defaults.projects, activeProjectId:saved.activeProjectId || defaults.activeProjectId };
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
    populateUsers(); populateProjects(); bindNavigation(); bindForms(); bindControls(); route(); renderAll();
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

  function populateProjects() {
    const options = state.projects.map(project => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("");
    $("#projectSelect").innerHTML = options;
    $("#projectSelect").value = state.activeProjectId;
    $("#projectCopySource").innerHTML = `<option value="">不复制，使用默认设置</option>${options}`;
  }

  async function switchProject(projectId) {
    if (!projectId || projectId === state.activeProjectId) return;
    try {
      if (backend && backendMeetingId) await loadBackendState(projectId);
      else {
        const project = state.projects.find(item => item.id === projectId);
        if (!project) return;
        state.activeProjectId = projectId;
        state.settings = { ...state.settings, eventName:project.name, slug:project.slug, clientName:project.clientName||"", startDate:project.startDate||"", endDate:project.endDate||"", brandColor:project.brandColor||"#5267d9" };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
      populateUsers(); populateProjects(); renderAll(); location.hash = "dashboard"; toast(`已切换至${state.settings.eventName}`);
    } catch (error) { toast(`项目切换失败：${error.message}`, "error"); populateProjects(); }
  }

  async function createProject(event) {
    event.preventDefault();
    const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
    const name = String(data.name||"").trim(); const slug = String(data.slug||"").trim().toLowerCase();
    $("#projectFormError").textContent = "";
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return $("#projectFormError").textContent = "请填写项目名称，并使用正确的英文项目编号";
    try {
      let projectId;
      if (backend && backendMeetingId) {
        const { data:created,error } = await backend.rpc("create_meeting_project", { p_name:name, p_slug:slug, p_source_id:data.sourceId||null });
        if (error) throw error; projectId = created; await loadBackendState(projectId);
      } else {
        if (state.projects.some(project => project.slug === slug)) throw new Error("项目编号已存在");
        projectId = `demo-${Date.now()}`;
        const source = state.projects.find(project => project.id === data.sourceId);
        state.projects.push({ id:projectId, slug, name, clientName:source?.clientName||"", role:"ops", attendeeCount:0, startDate:source?.startDate||"", endDate:source?.endDate||"", brandColor:source?.brandColor||"#5267d9" });
        state.activeProjectId = projectId; state.settings = { ...initialState().settings, ...(source ? state.settings : {}), eventName:name, slug };
        state.attendees = []; state.notifications = []; state.locks = {master:false,columns:[],rows:[]}; localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      }
      form.reset(); $("#projectDialog").close(); populateUsers(); populateProjects(); renderAll(); location.hash = "dashboard"; toast("项目已创建");
    } catch (error) { $("#projectFormError").textContent = error.message.includes("duplicate") ? "项目编号已存在，请更换" : error.message; }
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
      populateUsers(); populateProjects(); renderAll(); $("#loginDialog").close(); toast("登录成功");
    });
  }

  async function loadBackendState(preferredMeetingId = null) {
    const { data: authData } = await backend.auth.getUser();
    if (!authData.user) throw new Error("登录已过期");
    const membershipRes = await backend.from("meeting_members").select("meeting_id,role,display_name,phone,meetings(*)").eq("user_id",authData.user.id);
    if (membershipRes.error) throw new Error("请先运行多项目数据库升级脚本");
    projectMemberships = membershipRes.data || [];
    if (!projectMemberships.length) throw new Error("当前账号尚未加入任何项目");
    const savedProjectId = localStorage.getItem("journey-desk-active-project");
    backendMeetingId = [preferredMeetingId,savedProjectId,backendMeetingId].find(id => projectMemberships.some(item => item.meeting_id === id)) || projectMemberships[0].meeting_id;
    localStorage.setItem("journey-desk-active-project",backendMeetingId);
    const activeMembership = projectMemberships.find(item => item.meeting_id === backendMeetingId);
    const [meetingRes, membersRes, attendeesRes, locksRes, noticesRes] = await Promise.all([
      backend.from("meetings").select("*").eq("id", backendMeetingId).single(),
      backend.from("meeting_members").select("*").eq("meeting_id", backendMeetingId),
      backend.from("attendees").select("*,transports(*)").eq("meeting_id", backendMeetingId).order("created_at", { ascending: false }),
      backend.from("column_locks").select("*").eq("meeting_id", backendMeetingId),
      backend.from("notifications").select("*").eq("meeting_id", backendMeetingId).order("created_at", { ascending: false }).limit(100),
    ]);
    for (const result of [meetingRes, membersRes, attendeesRes, locksRes, noticesRes]) if (result.error) throw result.error;
    const meeting = meetingRes.data;
    state = {
      currentUserId: authData.user.id,
      activeProjectId: backendMeetingId,
      projects: projectMemberships.map(item => { const m = item.meetings || {}; return { id:item.meeting_id, slug:m.slug, name:m.name, clientName:m.client_name||"", role:item.role, startDate:m.start_date||"", endDate:m.end_date||"", brandColor:m.brand_color||"#5267d9" }; }),
      users: membersRes.data.map(p => ({ id:p.user_id, name:p.display_name, role:p.role, label:({ops:"会务负责人",client:"会议负责人（客户）",sales:"销售负责人"})[p.role], phone:p.phone||"" })),
      settings: { eventName:meeting.name, slug:meeting.slug, clientName:meeting.client_name||"", startDate:meeting.start_date||"", endDate:meeting.end_date||"", venues:meeting.venues||[], servicePhone:meeting.service_phone||"", brandColor:meeting.brand_color||"#5267d9", deadline:meeting.deadline?.slice(0,16)||"", capacity:meeting.capacity, allowedCities:meeting.allowed_departure_cities||[], mismatchRule:meeting.check_city_mismatch, departureRule:meeting.check_departure_city, flightLeadMinutes:meeting.flight_lead_minutes??120, trainLeadMinutes:meeting.train_lead_minutes??90, fieldConfig:{title:true,hcpId:true,accommodation:true,flight:true,mslContact:true,remarks:true,...(meeting.field_config||{})} },
      locks: { master: meeting.master_locked, columns: locksRes.data.filter(l => l.locked).map(l => l.field_group), rows: attendeesRes.data.filter(a => a.row_locked).map(a => a.id) },
      attendees: attendeesRes.data.map(fromDbAttendee),
      notifications: noticesRes.data.map(n => ({ id: n.id, type: n.type, text: n.message, time: n.created_at, read: !!n.read_at })),
    };
    if (!state.users.some(user => user.id === authData.user.id) && activeMembership) state.users.push({id:authData.user.id,name:activeMembership.display_name,role:activeMembership.role,label:"项目成员",phone:activeMembership.phone||""});
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function fromDbAttendee(row) {
    const trip = direction => {
      const t = row.transports?.find(item => item.direction === direction) || {};
      return { driver: t.driver_name || "待分配", phone: t.driver_phone || "—", vehicle: t.vehicle || "待分配", time: t.service_time ? new Date(t.service_time).toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-") : "待设置", point: t.meeting_point || "待设置" };
    };
    return { id:row.id, attendeeType:row.attendee_type||"", name:row.name, city:row.city||"", hospital:row.hospital||"", department:row.department||"", title:row.title||"", venue:row.venue||"", sex:row.sex||"", idNumber:row.id_number, phone:row.phone, hcpId:row.hcp_id, accommodation:row.accommodation?"Y":"N", flight:row.is_flight?"Y":"N", region:row.region||"", contactName:row.contact_name||"", contactMobile:row.contact_mobile||"", mslContact:row.msl_contact||"", remarks:row.remarks||"", ownerId:row.owner_id, outDate:row.out_date||"", outFrom:row.out_from||"", outTo:row.out_to||"", outNo:row.out_no||"", outDeparture:(row.out_departure||"").slice(0,5), outArrival:(row.out_arrival||"").slice(0,5), returnDate:row.return_date||"", returnFrom:row.return_from||"", returnTo:row.return_to||"", returnNo:row.return_no||"", returnDeparture:(row.return_departure||"").slice(0,5), returnArrival:(row.return_arrival||"").slice(0,5), approval:row.approval, risks:row.risks||[], createdAt:row.created_at, transport:{pickup:trip("pickup"),dropoff:trip("dropoff")} };
  }

  function toDbAttendee(a) {
    return { id:a.id, meeting_id:backendMeetingId, owner_id:a.ownerId, attendee_type:a.attendeeType||null, name:a.name, city:a.city||null, hospital:a.hospital||null, department:a.department||null, title:a.title||null, venue:a.venue||null, sex:a.sex||null, id_number:a.idNumber, phone:a.phone, hcp_id:a.hcpId, accommodation:a.accommodation==="Y", is_flight:a.flight==="Y", out_date:a.outDate||null, out_from:a.outFrom||null, out_to:a.outTo||null, out_no:a.outNo||null, out_departure:a.outDeparture||null, out_arrival:a.outArrival||null, return_date:a.returnDate||null, return_from:a.returnFrom||null, return_to:a.returnTo||null, return_no:a.returnNo||null, return_departure:a.returnDeparture||null, return_arrival:a.returnArrival||null, region:a.region||null, contact_name:a.contactName||null, contact_mobile:a.contactMobile||null, msl_contact:a.mslContact||null, remarks:a.remarks||null, approval:a.approval, risks:a.risks||[], row_locked:state.locks.rows.includes(a.id) };
  }

  async function syncBackend() {
    if (!backend || !backendMeetingId) return;
    const attendeeRows = state.attendees.map(toDbAttendee);
    if (attendeeRows.length) { const { error } = await backend.from("attendees").upsert(attendeeRows); if (error) throw error; }
    const transportRows = state.attendees.flatMap(a => ["pickup","dropoff"].map(direction => { const t = a.transport?.[direction] || {}; return { attendee_id:a.id, direction, driver_name:t.driver||null, driver_phone:t.phone||null, vehicle:t.vehicle||null, service_time:parseServiceTime(t.time), meeting_point:t.point||null }; }));
    if (transportRows.length) { const { error } = await backend.from("transports").upsert(transportRows,{onConflict:"attendee_id,direction"}); if (error) throw error; }
    if (canManage()) {
      const { error } = await backend.from("meetings").update({ name:state.settings.eventName, client_name:state.settings.clientName||null, start_date:state.settings.startDate||null, end_date:state.settings.endDate||null, venues:state.settings.venues, service_phone:state.settings.servicePhone||null, brand_color:state.settings.brandColor, deadline:state.settings.deadline||null, capacity:state.settings.capacity, allowed_departure_cities:state.settings.allowedCities, check_city_mismatch:state.settings.mismatchRule, check_departure_city:state.settings.departureRule, flight_lead_minutes:state.settings.flightLeadMinutes, train_lead_minutes:state.settings.trainLeadMinutes, field_config:state.settings.fieldConfig, master_locked:state.locks.master }).eq("id",backendMeetingId); if (error) throw error;
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
    $("#publicFullRegistrationForm").addEventListener("submit", submitPublicFullRegistration);
    $("#lookupForm").addEventListener("submit", queryTransport);
    $("#settingsForm").addEventListener("submit", saveSettings);
    $("#projectForm").addEventListener("submit", createProject);
  }

  function bindControls() {
    $("#projectSelect").addEventListener("change", event => switchProject(event.target.value));
    $("#newProjectButton").addEventListener("click", () => { const form=$("#projectForm"); form.reset(); $("#projectFormError").textContent=""; $("#projectDialog").showModal(); });
    $("#projectForm").elements.name.addEventListener("input", event => { const slug=$("#projectForm").elements.slug; if (!slug.dataset.edited) slug.value = `project-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(Date.now()).slice(-4)}`; });
    $("#projectForm").elements.slug.addEventListener("input", event => event.target.dataset.edited = event.target.value ? "1" : "");
    $("#userSelect").addEventListener("change", event => { state.currentUserId = event.target.value; saveState(); renderAll(); toast(`已切换为${currentUser().label}`); });
    $("#attendeeSearch").addEventListener("input", renderAttendeeTable);
    $("#riskFilter").addEventListener("change", renderAttendeeTable);
    $("#venueFilter").addEventListener("change", renderAttendeeTable);
    $("#transportSearch").addEventListener("input", renderTransport);
    $$('[data-transport-filter]').forEach(button => button.addEventListener("click", () => { activeTransportFilter = button.dataset.transportFilter; $$('[data-transport-filter]').forEach(b => b.classList.toggle("active", b === button)); renderTransport(); }));
    $("#exportExcel").addEventListener("click", exportExcel);
    $("#importRoster").addEventListener("click", openRosterImport);
    $("#rosterFile").addEventListener("change", event => readRosterFile(event.target.files[0]));
    $("#confirmImport").addEventListener("click", confirmRosterImport);
    $("#cancelImport").addEventListener("click", () => $("#importDialog").close());
    const dropzone=$("#importDropzone");
    ["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add("dragging");}));
    ["dragleave","drop"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove("dragging");}));
    dropzone.addEventListener("drop",event=>readRosterFile(event.dataTransfer.files[0]));
    $("#markAllRead").addEventListener("click", async () => { state.notifications.forEach(n => n.read = true); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); if (backend && backendMeetingId) await backend.from("notifications").update({read_at:new Date().toISOString()}).eq("meeting_id",backendMeetingId).is("read_at",null); renderNotifications(); renderCounts(); });
    $("#masterLock").addEventListener("change", event => { if (!canManage()) return deny(); state.locks.master = event.target.checked; addNotification("lock", `${currentUser().name}${event.target.checked ? "锁定" : "解锁"}了全部名单`); saveState(); renderAll(); });
    $("#copyRegistrationLink").addEventListener("click", copyRegistrationLink);
    $("#downloadQr").addEventListener("click", downloadQr);
    $("#backToPublicAuth").addEventListener("click", resetPublicRegistrationStep);
    $$('[data-portal-tab]').forEach(button => button.addEventListener("click", () => { location.hash = button.dataset.portalTab === "lookup" ? "lookup" : "portal"; }));
    $("#resetDemo").addEventListener("click", () => { if (!confirm("确认恢复全部演示数据？")) return; state = initialState(); saveState(); populateUsers(); populateProjects(); renderAll(); toast("已恢复演示数据"); });
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
    const visual=projectVisual(currentProject()); $("#activeProjectIcon").textContent=visual.icon; $("#activeProjectIcon").style.setProperty("--project-accent",visual.color); document.documentElement.style.setProperty("--project-accent",visual.color);
    renderRegistrationOwner(); renderCounts(); renderDashboard(); renderAttendeeTable(); renderApprovals(); renderTransport(); renderLocks(); renderNotifications(); renderSettings(); renderProjects(); renderQr();
  }

  function renderProjects() {
    $("#projectGrid").innerHTML = state.projects.map(project => {
      const active = project.id === state.activeProjectId; const role = ({ops:"会务负责人",client:"会议负责人（客户）",sales:"销售 / 负责人"})[project.role] || "项目成员"; const visual=projectVisual(project);
      return `<article class="panel project-card ${active ? "active" : ""}" style="--project-color:${visual.color}"><div class="project-card-top"><span class="project-card-icon">${visual.icon}</span><span class="status ${active ? "status-normal" : ""}">${active ? "当前项目" : escapeHtml(role)}</span></div><h2>${escapeHtml(project.name)}</h2><p>${escapeHtml(project.clientName||"未设置客户")} · ${escapeHtml(project.startDate||"日期待定")}${project.endDate ? ` 至 ${escapeHtml(project.endDate)}` : ""}</p><small>公开入口：?event=${escapeHtml(project.slug)}</small><div class="project-actions"><button class="button button-primary" data-switch-project="${project.id}" ${active ? "disabled" : ""}>${active ? "正在使用" : "进入项目"}</button><button class="button button-secondary" data-copy-project="${project.id}">复制项目</button><button class="text-button" data-copy-project-link="${project.id}">复制入口</button></div></article>`;
    }).join("");
    $$('[data-switch-project]').forEach(button => button.onclick = () => switchProject(button.dataset.switchProject));
    $$('[data-copy-project]').forEach(button => button.onclick = () => { const project=state.projects.find(item=>item.id===button.dataset.copyProject); const form=$("#projectForm"); form.reset(); form.elements.name.value=`${project.name}（复制）`; form.elements.sourceId.value=project.id; form.elements.slug.value=`${project.slug}-copy-${String(Date.now()).slice(-4)}`; form.elements.slug.dataset.edited="1"; $("#projectDialog").showModal(); });
    $$('[data-copy-project-link]').forEach(button => button.onclick = () => { const project=state.projects.find(item=>item.id===button.dataset.copyProjectLink); const url=new URL(location.href); url.searchParams.set("event",project.slug); url.hash="portal"; navigator.clipboard?.writeText(url.toString()).then(()=>toast("项目入口已复制")).catch(()=>toast(url.toString())); });
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
      ["已报名人数", list.length, `名额 ${state.settings.capacity} 人`, "♟", "#e4e9ff"],
      ["待审批行程", pending, pending ? "需要及时处理" : "全部处理完成", "△", "#fae3d8"],
      ["住宿需求", list.filter(a => a.accommodation === "Y").length, "已选择住宿", "⌂", "#e9e6f6"],
      ["已安排接送", assigned, `共 ${list.length} 位参会者`, "↗", "#f3e8c8"],
    ];
    $("#metricGrid").innerHTML = metrics.map(([label,value,note,icon,tint]) => `<article class="metric-card" style="--metric-tint:${tint}"><p>${label}</p><strong>${value}</strong><small>${note}</small><span>${icon}</span></article>`).join("");
    $("#progressCount").textContent = list.length; const percent = Math.min(100, Math.round(list.length / state.settings.capacity * 100));
    $("#progressBar").style.width = `${percent}%`; $("#progressPercent").textContent = `${percent}%`;
    const cityCounts = Object.entries(list.reduce((acc,a) => (acc[a.city] = (acc[a.city] || 0) + 1, acc), {})).sort((a,b) => b[1] - a[1]).slice(0,4);
    const max = Math.max(...cityCounts.map(([,v]) => v), 1); const colors = ["#5267d9", "#3e8fc6", "#d49a28", "#b665d6"];
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
    $("#importRoster").classList.toggle("is-hidden", currentUser().role !== "ops");
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
        cards.push(`<article class="transport-card"><div class="transport-head"><div><h3>${escapeHtml(a.name)} · ${type === "pickup" ? "接机" : "送机"}</h3><p>${escapeHtml(type === "pickup" ? `${a.outNo} · ${a.outArrival} 到达` : `${a.returnNo} · ${a.returnDeparture} 出发`)}</p></div><span class="status ${assigned ? "status-normal" : "status-pending"}">${assigned ? (staff ? "工作人员接待" : "独立司机") : "待分配"}</span></div><div class="transport-details"><div><small>接送方式</small><strong>${escapeHtml(contact)}</strong></div><div><small>车辆</small><strong>${escapeHtml(vehicle)}</strong></div><div><small>时间</small><strong>${escapeHtml(item.time || "待设置")}</strong></div><div><small>集合点</small><strong>${escapeHtml(item.point || "待设置")}</strong></div></div>${type === "dropoff" ? `<div class="transport-rule">${isFlightReturn(a) ? `航班起飞前 ${state.settings.flightLeadMinutes} 分钟` : `高铁出发前 ${state.settings.trainLeadMinutes} 分钟`} · 建议 ${escapeHtml(recommendedDropoffTime(a) || "待补全返程时间")}</div>` : ""}${canManage() ? `<button class="transport-edit" data-edit-transport="${a.id}" data-type="${type}">编辑安排 →</button>` : ""}</article>`);
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
    const form = $("#settingsForm");
    const values = { eventName:state.settings.eventName, clientName:state.settings.clientName, startDate:state.settings.startDate, endDate:state.settings.endDate, venues:state.settings.venues.join("、"), deadline:state.settings.deadline, capacity:state.settings.capacity, servicePhone:state.settings.servicePhone, allowedCities:state.settings.allowedCities.join("、"), flightLeadMinutes:state.settings.flightLeadMinutes, trainLeadMinutes:state.settings.trainLeadMinutes };
    Object.entries(values).forEach(([name,value]) => { if (form.elements[name]) form.elements[name].value=value??""; });
    form.elements.mismatchRule.checked = state.settings.mismatchRule; form.elements.departureRule.checked = state.settings.departureRule;
    const fieldNames = {fieldTitle:"title",fieldHcpId:"hcpId",fieldAccommodation:"accommodation",fieldFlight:"flight",fieldMslContact:"mslContact",fieldRemarks:"remarks"};
    Object.entries(fieldNames).forEach(([name,key]) => form.elements[name].checked = state.settings.fieldConfig[key] !== false);
    $$('input,textarea,select,button[type="submit"]', form).forEach(input => input.disabled = !canManage() && input.id !== "resetDemo");
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
    $("#attendeeDetail").innerHTML = `<div class="detail-head"><span class="kicker" style="color:#b9ddc5">TRANSPORT</span><h2>${escapeHtml(a.name)} · ${typeName}</h2><p>更新后参会者可在公开查询端立即查看</p></div><form class="detail-body" id="transportEditForm"><div class="field-grid"><label class="span-2">接送方式<select name="mode" id="transportMode"><option value="staff" ${currentMode === "staff" ? "selected" : ""}>机场 / 车站工作人员接待</option><option value="driver" ${currentMode === "driver" ? "selected" : ""}>独立司机接送</option></select></label><div class="span-2 driver-fields" id="driverFields"><div class="field-grid"><label>司机姓名<input name="driver" value="${escapeHtml(currentMode === "driver" ? t.driver || "" : "")}"></label><label>司机电话<input name="phone" value="${escapeHtml(currentMode === "driver" ? t.phone || "" : "")}"></label><label class="span-2">车辆 / 车牌<input name="vehicle" value="${escapeHtml(currentMode === "driver" ? t.vehicle || "" : "")}"></label></div></div><label>接送时间<input name="time" value="${escapeHtml(savedTime || "")}" placeholder="YYYY-MM-DD HH:mm" required></label><label>集合点<input name="point" value="${escapeHtml(t.point || "")}" required></label></div>${type === "dropoff" ? `<div class="risk-preview ok">✓ 自动建议：${isFlightReturn(a) ? `机场按航班起飞前 ${state.settings.flightLeadMinutes} 分钟` : `高铁站按列车出发前 ${state.settings.trainLeadMinutes} 分钟`}，当前建议 ${escapeHtml(suggested || "请先补全返程日期与时间")}；可按城市路况手动调整。</div>` : `<div class="risk-preview">工作人员接待时，无需录入司机、电话和车辆。</div>`}<div class="detail-actions"><button class="button button-primary" type="submit">保存安排</button><button class="button button-secondary" type="button" id="cancelTransport">取消</button></div></form>`;
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
    departure.setMinutes(departure.getMinutes() - (isFlightReturn(a) ? state.settings.flightLeadMinutes : state.settings.trainLeadMinutes));
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
    submit.disabled = true; submit.textContent = "正在验证…";
    try {
      const response = await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`, {
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey},
        body:JSON.stringify({action:"authenticate",meeting:currentEventSlug(),region:data.region,name:data.name,phone}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "验证失败");
      publicAuthSession = { region:data.region.trim(), name:data.name.trim(), phone }; publicProjectConfig = payload.project || null; applyPublicProject(payload.project);
      showPublicFullRegistration(payload.attendee || publicAuthSession);
    } catch (error) { result.innerHTML = `<div class="lookup-error">${escapeHtml(error.message)}</div>`; }
    finally { submit.disabled = false; submit.innerHTML = `验证并进入报名表 <span>→</span>`; }
  }

  function showPublicFullRegistration(attendee = {}) {
    const form = $("#publicFullRegistrationForm");
    const aliases = { attendeeType:"attendeeType", name:"name", city:"city", hospital:"hospital", department:"department", title:"title", venue:"venue", sex:"sex", idNumber:"idNumber", phone:"phone", hcpId:"hcpId", accommodation:"accommodation", flight:"flight", region:"region", contactName:"contactName", contactMobile:"contactMobile", mslContact:"mslContact", remarks:"remarks", outDate:"outDate", outFrom:"outFrom", outTo:"outTo", outNo:"outNo", outDeparture:"outDeparture", outArrival:"outArrival", returnDate:"returnDate", returnFrom:"returnFrom", returnTo:"returnTo", returnNo:"returnNo", returnDeparture:"returnDeparture", returnArrival:"returnArrival" };
    Object.entries(aliases).forEach(([field,key]) => { if (form.elements[field]) form.elements[field].value = attendee[key] ?? publicAuthSession?.[key] ?? (field === "attendeeType" ? "HCP" : ""); });
    form.elements.name.value = publicAuthSession.name; form.elements.phone.value = publicAuthSession.phone; form.elements.region.value = publicAuthSession.region;
    applyPublicFieldConfig(publicProjectConfig?.fieldConfig || {});
    $("#publicRegistrationResult").innerHTML = ""; $("#publicAuthStep").classList.add("is-hidden"); $("#publicFullRegistrationStep").classList.remove("is-hidden"); $(".portal-card").classList.add("expanded");
    scrollTo({top:0,behavior:"smooth"});
  }

  function applyPublicProject(project = {}) {
    if (!project) return;
    document.title = `行程台 · ${project.name || "参会服务"}`;
    const footer=$(".public-footer"); if (footer) footer.textContent = project.servicePhone ? `会务服务台 ${project.servicePhone} · 工作时间 08:00–21:00` : "会务服务台 · 工作时间 08:00–21:00";
    const venueSelect=$("#publicFullRegistrationForm").elements.venue;
    if (venueSelect && project.venues?.length) { const selected=venueSelect.value; venueSelect.innerHTML=`<option value="">请选择</option>${project.venues.map(venue=>`<option>${escapeHtml(venue)}</option>`).join("")}`; venueSelect.value=project.venues.includes(selected) ? selected : ""; }
  }

  function applyPublicFieldConfig(config = {}) {
    $$('[data-config-field]', $("#publicFullRegistrationForm")).forEach(label => {
      const visible = config[label.dataset.configField] !== false; label.classList.toggle("is-hidden", !visible);
      $$('input,select,textarea',label).forEach(input => { if (!visible) { input.dataset.wasRequired=String(input.required); input.required=false; input.value=""; } else if (input.dataset.wasRequired === "true") input.required=true; });
    });
  }

  function resetPublicRegistrationStep() {
    publicAuthSession = null; const form = $("#publicFullRegistrationForm"); form.reset(); form.querySelectorAll("input,select,textarea").forEach(input => input.disabled = false); form.querySelector('button[type="submit"]').classList.remove("is-hidden"); $("#backToPublicAuth").textContent = "返回验证"; $("#publicFullRegistrationStep").classList.add("is-hidden"); $("#publicAuthStep").classList.remove("is-hidden"); $(".portal-card").classList.remove("expanded"); $("#publicFullRegistrationResult").innerHTML = "";
  }

  async function submitPublicFullRegistration(event) {
    event.preventDefault(); if (!publicAuthSession) return resetPublicRegistrationStep();
    const form = event.currentTarget; const result = $("#publicFullRegistrationResult"); const submit = form.querySelector('button[type="submit"]');
    const details = Object.fromEntries(new FormData(form)); details.contactMobile = normalizePhone(details.contactMobile);
    if (details.contactMobile.length !== 11) { result.innerHTML = `<div class="lookup-error">请输入正确的销售联系人手机号。</div>`; return; }
    submit.disabled = true; submit.textContent = "正在保存…";
    try {
      const response = await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`, { method:"POST", headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey}, body:JSON.stringify({action:"complete-registration",meeting:currentEventSlug(),...publicAuthSession,...details}) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "提交失败");
      result.innerHTML = `<div class="lookup-success"><strong>✓ 完整报名已保存</strong><br />${payload.needsApproval ? "行程异常已自动提交会务负责人审批。" : "可返回参会服务查询后续接送安排。"}</div>`;
      form.querySelectorAll("input,select,textarea").forEach(input => input.disabled = true); submit.classList.add("is-hidden"); $("#backToPublicAuth").textContent = "完成并返回";
    } catch (error) { result.innerHTML = `<div class="lookup-error">${escapeHtml(error.message)}</div>`; }
    finally { submit.disabled = false; if (!submit.classList.contains("is-hidden")) submit.textContent = "提交完整报名"; }
  }

  async function queryTransport(event) {
    event.preventDefault(); const phone = normalizePhone($("#lookupPhone").value); const result = $("#lookupResult");
    if (phone.length !== 11) { result.innerHTML = `<div class="lookup-error">请输入正确的 11 位手机号</div>`; return; }
    lastLookupSchedule = null;
    if (window.APP_CONFIG?.mode === "production" && window.APP_CONFIG.supabaseUrl) {
      try {
        const response = await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`, { method:"POST", headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey}, body:JSON.stringify({phone,meeting:currentEventSlug()}) });
        const payload = await response.json(); applyPublicProject(payload.project);
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
    return `<div class="lookup-name">${escapeHtml(name)}，你的安排如下</div>${card("接机",outbound,pickup)}${card("送机",returnTrip,dropoff)}<div class="calendar-action"><strong>还差一步：开启手机自动提醒</strong><span>受手机隐私规则限制，网页不能静默写入日历。请点击并在系统弹窗中确认“添加全部”。</span><button class="button button-primary button-block calendar-button" id="addCalendarButton" type="button">加入手机日历 · 接送前 30 分钟提醒</button></div>`;
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
    const url = URL.createObjectURL(new Blob([content],{type:"text/calendar;charset=utf-8"}));
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) location.href = url;
    else { const link = document.createElement("a"); link.href = url; link.download = `HEMA-SEM-${lastLookupSchedule.name}-接送提醒.ics`; document.body.append(link); link.click(); link.remove(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000); toast("请在系统界面确认添加全部日历事项");
  }

  function saveSettings(event) {
    event.preventDefault(); if (!canManage()) return deny(); const data = Object.fromEntries(new FormData(event.currentTarget));
    Object.assign(state.settings,{ eventName:data.eventName, clientName:data.clientName, startDate:data.startDate, endDate:data.endDate, deadline:data.deadline, capacity:Number(data.capacity)||120, servicePhone:data.servicePhone, flightLeadMinutes:Number(data.flightLeadMinutes)||120, trainLeadMinutes:Number(data.trainLeadMinutes)||90, venues:String(data.venues||"").split(/[、,，\s]+/).map(v=>v.trim()).filter(Boolean), allowedCities:String(data.allowedCities||"").split(/[、,，\s]+/).map(v=>v.trim()).filter(Boolean), mismatchRule:!!data.mismatchRule, departureRule:!!data.departureRule, fieldConfig:{title:!!data.fieldTitle,hcpId:!!data.fieldHcpId,accommodation:!!data.fieldAccommodation,flight:!!data.fieldFlight,mslContact:!!data.fieldMslContact,remarks:!!data.fieldRemarks} });
    const project=currentProject(); Object.assign(project,{name:state.settings.eventName,clientName:state.settings.clientName,startDate:state.settings.startDate,endDate:state.settings.endDate,brandColor:state.settings.brandColor});
    addNotification("change", `${currentUser().name}更新了项目和行程预警设置`); saveState(); populateProjects(); renderAll(); toast("项目设置已保存");
  }

  function copyRegistrationLink() { const url = publicProjectUrl(); navigator.clipboard?.writeText(url).then(() => toast("参会服务链接已复制")).catch(() => toast(url)); }
  function renderQr() { const box = $("#qrCanvas"); if (!box) return; const url = publicProjectUrl(); box.innerHTML = ""; if (window.QRCode) new QRCode(box, { text:url, width:256, height:256, colorDark:"#000000", colorLight:"#ffffff", correctLevel:QRCode.CorrectLevel.M }); else box.innerHTML = `<button class="text-button" type="button">复制参会服务链接</button>`; box.querySelector("button")?.addEventListener("click",copyRegistrationLink); const direct=$(".qr-direct-link"); if (direct) direct.href=url; }
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
    link.download = `${state.settings.slug||"journey"}-参会服务二维码.png`;
    link.href = output.toDataURL("image/png");
    link.click();
  }

  function openRosterImport() {
    if (currentUser().role !== "ops") return toast("仅会务负责人可以导入线下名单", "error");
    if (state.locks.master) return toast("全名单已锁定，请先解锁再导入", "error");
    pendingImportRows=[]; $("#rosterFile").value=""; $("#confirmImport").disabled=true;
    $("#importPreview").innerHTML=`<div class="empty-state">选择文件后将在此显示校验结果</div>`; $("#importDialog").showModal();
  }

  const cleanCell = value => String(value ?? "").trim();
  function excelDate(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
    if (typeof value === "number" && window.XLSX?.SSF) { const d=XLSX.SSF.parse_date_code(value); if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`; }
    const text=cleanCell(value).replace(/[年/.]/g,"-").replace(/月/g,"-").replace(/日/g,""); const match=text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
    return match ? `${match[1]}-${match[2].padStart(2,"0")}-${match[3].padStart(2,"0")}` : text;
  }
  function excelTime(value) {
    if (value === "" || value == null) return "";
    if (typeof value === "number") { const minutes=Math.round((value%1)*1440)%1440; return `${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`; }
    if (value instanceof Date) return `${String(value.getHours()).padStart(2,"0")}:${String(value.getMinutes()).padStart(2,"0")}`;
    const match=cleanCell(value).match(/(\d{1,2}):(\d{2})/); return match ? `${match[1].padStart(2,"0")}:${match[2]}` : cleanCell(value);
  }
  function yesNo(value, fallback="N") { const text=cleanCell(value).toUpperCase(); return ["Y","YES","是","TRUE","1"].includes(text) ? "Y" : ["N","NO","否","FALSE","0"].includes(text) ? "N" : fallback; }

  async function readRosterFile(file) {
    const preview=$("#importPreview"); pendingImportRows=[]; $("#confirmImport").disabled=true;
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return preview.innerHTML=`<div class="lookup-error">请选择 .xlsx、.xls 或 .csv 文件。</div>`;
    if (!window.XLSX) return preview.innerHTML=`<div class="lookup-error">Excel 组件尚未加载，请刷新页面后重试。</div>`;
    preview.innerHTML=`<div class="import-reading"><span></span>正在读取 ${escapeHtml(file.name)}…</div>`;
    try {
      const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}); const sheet=workbook.Sheets[workbook.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:true});
      const headerIndex=rows.findIndex(row=>row.some(cell=>cleanCell(cell).includes("客户姓名"))&&row.some(cell=>cleanCell(cell).includes("手机号")));
      if (headerIndex<0 || (rows[headerIndex]||[]).length<20) throw new Error("没有识别到报名模板表头，请使用31列报名表模板");
      const seen=new Set();
      pendingImportRows=rows.slice(headerIndex+1).filter(row=>row.slice(1).some(value=>cleanCell(value))).map((row,index)=>buildImportRow(row,headerIndex+index+2,seen));
      if (!pendingImportRows.length) throw new Error("名单中没有可读取的参会者数据");
      renderImportPreview(file.name);
    } catch (error) { preview.innerHTML=`<div class="lookup-error">${escapeHtml(error.message||"文件读取失败")}</div>`; }
  }

  function buildImportRow(row, sheetRow, seen) {
    const phone=normalizePhone(row[10]); const contactMobile=normalizePhone(row[28]); const existing=state.attendees.find(item=>normalizePhone(item.phone)===phone);
    const matchedOwner=state.users.find(user=>user.role==="sales"&&contactMobile&&normalizePhone(user.phone)===contactMobile) || state.users.find(user=>user.role==="sales"&&cleanCell(row[27])&&user.name===cleanCell(row[27]));
    const attendee={
      id:existing?.id || (backend ? crypto.randomUUID() : `a-${Date.now()}-${sheetRow}`), ownerId:matchedOwner?.id || existing?.ownerId || currentUser().id,
      attendeeType:cleanCell(row[1])||"HCP", name:cleanCell(row[2]), city:cleanCell(row[3]), hospital:cleanCell(row[4]), department:cleanCell(row[5]), title:cleanCell(row[6]), venue:cleanCell(row[7]), sex:cleanCell(row[8]), idNumber:cleanCell(row[9]), phone, hcpId:cleanCell(row[11]), accommodation:yesNo(row[12]), flight:yesNo(row[13],/^[GDC]\d+/i.test(cleanCell(row[17]))?"N":"Y"),
      outDate:excelDate(row[14]),outFrom:cleanCell(row[15]),outTo:cleanCell(row[16]),outNo:cleanCell(row[17]),outDeparture:excelTime(row[18]),outArrival:excelTime(row[19]),returnDate:excelDate(row[20]),returnFrom:cleanCell(row[21]),returnTo:cleanCell(row[22]),returnNo:cleanCell(row[23]),returnDeparture:excelTime(row[24]),returnArrival:excelTime(row[25]),region:cleanCell(row[26]),contactName:cleanCell(row[27]),contactMobile,mslContact:cleanCell(row[29]),remarks:cleanCell(row[30]),createdAt:existing?.createdAt||new Date().toISOString(),transport:existing?.transport||{pickup:{driver:"待分配",phone:"—",vehicle:"待分配",time:"待设置",point:"待设置"},dropoff:{driver:"待分配",phone:"—",vehicle:"待分配",time:"待设置",point:"会议酒店大堂"}},
    };
    const errors=[];
    if (!attendee.name) errors.push("缺少姓名"); if (phone.length!==11) errors.push("手机号格式错误"); if (!attendee.idNumber) errors.push("缺少证件号"); if (!attendee.hcpId) errors.push("缺少HCP ID");
    if (phone&&seen.has(phone)) errors.push("文件内手机号重复"); if (phone) seen.add(phone); if (existing&&isLocked(existing)) errors.push("已有记录已锁定");
    attendee.risks=evaluateRisks(attendee); attendee.approval=attendee.risks.length?"pending":"normal";
    if (!existing) { attendee.transport.pickup.time=attendee.outDate&&attendee.outArrival?`${attendee.outDate} ${attendee.outArrival}`:"待设置"; attendee.transport.pickup.point=attendee.outTo?`${attendee.outTo}到达口`:"待设置"; attendee.transport.dropoff.time=recommendedDropoffTime(attendee)||"待设置"; }
    return {attendee,sheetRow,status:errors.length?"error":existing?"update":"new",errors};
  }

  function renderImportPreview(fileName) {
    const valid=pendingImportRows.filter(row=>row.status!=="error"); const added=valid.filter(row=>row.status==="new").length; const updated=valid.length-added; const errors=pendingImportRows.length-valid.length;
    $("#importPreview").innerHTML=`<div class="import-summary"><div class="import-file-name"><span>XL</span><p><strong>${escapeHtml(fileName)}</strong><small>共读取 ${pendingImportRows.length} 行</small></p></div><div class="import-stats"><div class="stat-new"><strong>${added}</strong><small>新增</small></div><div class="stat-update"><strong>${updated}</strong><small>更新</small></div><div class="stat-error"><strong>${errors}</strong><small>错误</small></div></div></div><div class="import-table-wrap"><table class="import-table"><thead><tr><th>Excel行</th><th>参会者</th><th>城市 / 会场</th><th>负责人</th><th>状态</th></tr></thead><tbody>${pendingImportRows.slice(0,100).map(item=>`<tr><td>${item.sheetRow}</td><td><strong>${escapeHtml(item.attendee.name||"未填写")}</strong><small>${escapeHtml(item.attendee.phone||"无手机号")}</small></td><td>${escapeHtml(item.attendee.city||"—")}<small>${escapeHtml(item.attendee.venue||"—")}</small></td><td>${escapeHtml(userName(item.attendee.ownerId))}</td><td><span class="import-status ${item.status}">${item.status==="new"?"新增":item.status==="update"?"更新":escapeHtml(item.errors.join("、"))}</span></td></tr>`).join("")}</tbody></table></div>${pendingImportRows.length>100?`<p class="import-more">仅预览前100行，确认后将处理全部有效记录。</p>`:""}`;
    $("#confirmImport").disabled=!valid.length; $("#confirmImport").textContent=`确认导入 ${valid.length} 条有效名单`;
  }

  function confirmRosterImport() {
    if (currentUser().role!=="ops"||state.locks.master) return toast("当前不能导入名单", "error");
    const valid=pendingImportRows.filter(row=>row.status!=="error"); if (!valid.length) return;
    valid.forEach(({attendee,status})=>{ const index=state.attendees.findIndex(item=>item.id===attendee.id); if (index>=0) state.attendees[index]=attendee; else state.attendees.unshift(attendee); });
    const added=valid.filter(row=>row.status==="new").length; const updated=valid.length-added; addNotification("create",`${currentUser().name}导入线下名单：新增${added}人，更新${updated}人`); saveState(); $("#importDialog").close(); renderAll(); toast(`已导入 ${valid.length} 条名单${pendingImportRows.some(row=>row.status==="error")?"，错误行未导入":""}`); pendingImportRows=[];
  }

  function exportExcel() {
    const headers = ["No.\n序号","Attendee Type\n参会者类别","Name\n客户姓名(姓/名)*","City\n城市","Hospital/Chain\n医院/连锁","Department/Store\n科室/门店","Title\n职称","会场\n（多城会议）","Sex\n性别","ID/Passpor No.*\n身份证号/护照号*","Mobile Phone #\n手机号","HCP ID*\n客户编号*","Accommodation\n住宿安排(Y/N)","Flight\n是否航空(Y/N)","Departure Date\n出发日期","Departure City 出发城市","Arrival City 到达城市","Flight/Train No.\n航班/车次号","Departure time 出发时间","Arrival time 到达时间","Return Date\n返回日期","Departure City 出发城市","Arrival City 到达城市","Flight/Train No.\n航班/车次号","Departure time 出发时间","Arrival time 到达时间","Region\n大区","Contact Name\n销售联系人姓名","Contact Mobile\n销售联系人手机","MSL医学部联系人","Remarks\n备注（本地客户/VIP异地用车备注）"];
    const rows = visibleAttendees().map((a,i) => [i+1,a.attendeeType,a.name,a.city,a.hospital,a.department,a.title,a.venue,a.sex,a.idNumber,a.phone,a.hcpId,a.accommodation,a.flight,a.outDate,a.outFrom,a.outTo,a.outNo,a.outDeparture,a.outArrival,a.returnDate,a.returnFrom,a.returnTo,a.returnNo,a.returnDeparture,a.returnArrival,a.region,a.contactName||userName(a.ownerId),a.contactMobile||state.users.find(u=>u.id===a.ownerId)?.phone||"",a.mslContact,a.remarks]);
    if (window.XLSX) { const ws = XLSX.utils.aoa_to_sheet([headers,...rows]); ws["!cols"] = headers.map((_,i) => ({ wch: i === 0 ? 7 : i >= 14 && i <= 25 ? 14 : 18 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"报名表"); XLSX.writeFile(wb,`HEMA-SEM-报名表-${new Date().toISOString().slice(0,10)}.xlsx`); toast("Excel 已导出"); }
    else { const csv = [headers,...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv"})); link.download = "HEMA-SEM-报名表.csv"; link.click(); toast("已导出兼容 Excel 的 CSV 文件"); }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
