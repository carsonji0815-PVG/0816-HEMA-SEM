(() => {
  "use strict";

  const STORAGE_KEY = "journey-desk-state-v1";
  const COLUMN_LOCKS = [
    ["identity", "身份与证件"], ["contact", "手机号"], ["outbound", "去程"],
    ["return", "返程"], ["accommodation", "住宿"], ["transport", "接送机"], ["remarks", "备注"],
  ];
  const STANDARD_TEMPLATE_HEADERS = ["No.\n序号","Attendee Type\n参会者类别","Name\n客户姓名(姓/名)*","City\n城市","Hospital/Chain\n医院/连锁","Department/Store\n科室/门店","Title\n职称","会场\n（多城会议）","Sex\n性别","ID/Passpor No.*\n身份证号/护照号*","Mobile Phone #\n手机号","HCP ID*\n客户编号*","Accommodation\n住宿安排(Y/N)","Flight\n是否航空(Y/N)","Departure Date\n出发日期","Departure City 出发城市","Arrival City 到达城市","Flight/Train No.\n航班/车次号","Departure time 出发时间","Arrival time 到达时间","Return Date\n返回日期","Departure City 出发城市","Arrival City 到达城市","Flight/Train No.\n航班/车次号","Departure time 出发时间","Arrival time 到达时间","Region\n大区","Contact Name\n销售联系人姓名","Contact Mobile\n销售联系人手机","MSL医学部联系人","Remarks\n备注（本地客户/VIP异地用车备注）"];
  const STANDARD_TEMPLATE_KEYS = ["sequence","attendeeType","name","city","hospital","department","title","venue","sex","idNumber","phone","hcpId","accommodation","flight","outDate","outFrom","outTo","outNo","outDeparture","outArrival","returnDate","returnFrom","returnTo","returnNo","returnDeparture","returnArrival","region","contactName","contactMobile","mslContact","remarks"];
  const CORE_AUTH_FIELDS = new Set(["name","phone","region"]);
  const FIELD_LABELS = {outDate:"去程日期",outFrom:"去程出发机场/车站",outTo:"去程抵达机场/车站",outNo:"去程航班/车次",outDeparture:"去程出发时间",outArrival:"去程抵达时间",returnDate:"返程日期",returnFrom:"返程出发机场/车站",returnTo:"返程抵达机场/车站",returnNo:"返程航班/车次",returnDeparture:"返程出发时间",returnArrival:"返程抵达时间",privacyLetterStatus:"隐私沟通函",ticketStatus:"出票状态"};
  const DOCUMENT_API_BASE = String(window.APP_CONFIG?.documentApiBase || "https://139.196.97.236").replace(/\/$/, "");
  const DOCUMENT_ADMIN_NAME = "季亮亮";
  const standardTemplate = () => ({ version:1, columns:STANDARD_TEMPLATE_HEADERS.map((header,index) => ({ header, key:STANDARD_TEMPLATE_KEYS[index], required:/\*/.test(header) || ["name","phone","region"].includes(STANDARD_TEMPLATE_KEYS[index]) })) });
  const initialState = () => ({
    currentUserId: "u-ops",
    activeProjectId: "demo-hema",
    projects: [{ id:"demo-hema", slug:"hema-sem-2026", name:"HEMA SEM · 大连 & 福州", activityType:"external", identifier:"HEMA-SEM-2026", activityOwner:"林悦", activityDate:"2026-09-04", clientName:"礼来", role:"ops", attendeeCount:5, startDate:"2026-09-04", endDate:"2026-09-12", brandColor:"#5267d9", registrationOpen:true, templateImported:true, managerEditEnabled:true }],
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
      transportGroupMinutes: 30,
      fieldConfig: { title:true, hcpId:true, accommodation:true, flight:true, mslContact:true, remarks:true },
      templateName: "标准31列报名模板",
      registrationTemplate: standardTemplate(),
      registrationOpen: true,
      templateImported: true,
      managerEditEnabled: true,
      registrationQuotas: [],
      quotaRegions: ["华北大区","华南大区","沪苏皖","浙闽粤赣","西南大区","鲁豫大区"],
      activityType: "external",
      identifier: "HEMA-SEM-2026",
      activityOwner: "林悦",
      activityDate: "2026-09-04",
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
  let activeQuotaRole = "听众";
  let incompleteRosterOnly = false;
  let cancelledRosterView = false;
  const selectedAttendeeIds = new Set();
  let backend = null;
  let backendMeetingId = null;
  let syncTimer = null;
  let lastLookupSchedule = null;
  let publicAuthSession = null;
  let publicProjectConfig = null;
  let publicProjectLoadedAt = 0;
  let publicProjectLoadPromise = null;
  let publicRegistrantAttendees = [];
  let publicEditingAttendeeId = null;
  let projectMemberships = [];
  let pendingImportRows = [];
  let documentState = { folder:null, files:[], user:null, loading:false };
  let projectArchiveStates = {};
  let staffAccess = { allowed:false, email:"", displayName:"", systemRole:"" };
  let staffDirectory = [];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const normalizePhone = value => String(value || "").replace(/\D/g, "").slice(-11);
  const normalizeVenueLabel = value => String(value || "").trim().replace(/会场$/u, "").trim();
  const dbDate = value => /^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(String(value||"")) ? value : null;
  const dbTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||"")) ? value : null;
  const normalizePrivacyStatus = value => value === "paper" ? "paper" : ["electronic","sent","complete"].includes(value) ? "electronic" : "pending";
  const currentUser = () => state.users.find(user => user.id === state.currentUserId) || state.users[0];
  const userName = id => state.users.find(user => user.id === id)?.name || "未分配";
  const visibleAttendees = () => currentUser().role === "sales" ? state.attendees.filter(item => item.ownerId === currentUser().id) : state.attendees;
  const activeVisibleAttendees = () => visibleAttendees().filter(item=>item.businessStatus!=="cancelled");
  const canManage = () => isSystemAdmin() || currentUser()?.role === "ops";
  const canEditAttendeeData = () => isSystemAdmin() || currentUser().role === "sales" || (canManage() && !!state.settings.managerEditEnabled);
  // The document service is the authority for archive permissions.  The
  // Journey Desk display name can differ from the archive membership name,
  // so relying on the local label alone incorrectly hid the administrator
  // scenario and final-document options.
  const isSystemAdmin = () => staffAccess.systemRole === "super_admin";
  const isDocumentAdmin = () => documentState.user?.role === "admin" || isSystemAdmin();
  const archiveSummary = files => {
    const list=files||[]; const quotation=list.some(file=>file.type==="quotation"); const pendingConfirmation=list.some(file=>file.type==="confirmation"&&file.documentStatus==="pending");
    return { quotation, pendingConfirmation, ready:quotation&&pendingConfirmation };
  };
  const activeArchiveReady = () => !!projectArchiveStates[backendMeetingId]?.ready;
  const activeManagementOpen = () => !!state.settings.registrationOpen || activeArchiveReady();
  const canOpenNewRegistration = () => !!state.settings.registrationOpen && !!state.settings.templateImported && !state.locks.master;
  const isLocked = attendee => state.locks.master || state.locks.rows.includes(attendee.id);
  const currentProject = () => state.projects.find(project => project.id === state.activeProjectId) || state.projects[0] || {};
  const currentEventSlug = () => new URLSearchParams(location.search).get("event") || window.APP_CONFIG?.eventSlug || state.settings.slug || "";
  const publicProjectUrl = (hash = "portal") => {
    const url = new URL(location.href);
    url.searchParams.delete("preview");
    url.searchParams.set("event", currentProject().slug || state.settings.slug || currentEventSlug());
    url.hash = hash;
    return url.toString();
  };
  const projectVisual = project => {
    const icons = ["✦","◈","✚","◎","⌁","◇","✺","⬡"];
    const colors = ["#D52B1E","#7b4f70","#df6555","#b07a2b","#397a73","#a8435b","#526d88","#667080"];
    const seed = [...String(project?.slug || project?.name || "project")].reduce((sum,char)=>sum+char.charCodeAt(0),0);
    return { icon:icons[seed%icons.length], color:colors[seed%colors.length] };
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved?.attendees) return initialState();
      const defaults = initialState();
      return { ...defaults, ...saved, attendees:saved.attendees.map(item=>({...item,privacyLetterStatus:normalizePrivacyStatus(item.privacyLetterStatus)})), settings:{...defaults.settings,...saved.settings}, projects:saved.projects?.length ? saved.projects : defaults.projects, activeProjectId:saved.activeProjectId || defaults.activeProjectId };
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

  const TERMINAL_ALIASES = new Map(Object.entries({
    "PEK T2":"北京首都国际机场T2航站楼","首都机场T2":"北京首都国际机场T2航站楼","北京首都T2":"北京首都国际机场T2航站楼",
    "PEK T3":"北京首都国际机场T3航站楼","首都机场T3":"北京首都国际机场T3航站楼","北京首都T3":"北京首都国际机场T3航站楼",
    "PKX":"北京大兴国际机场","大兴机场":"北京大兴国际机场","北京大兴机场":"北京大兴国际机场",
    "北京南":"北京南站","北京西":"北京西站","北京朝阳":"北京朝阳站","北京丰台":"北京丰台站",
    "上海虹桥":"上海虹桥站","上海南":"上海南站","福州南":"福州南站","大连北":"大连北站",
  }));
  const normalizeTerminal = value => TERMINAL_ALIASES.get(String(value||"").trim()) || String(value||"").trim();
  const isTrainNumber = value => /^(G|D|C|S|Z|T|K)\d+/i.test(String(value||"").trim());
  const isPreciseTerminal = (value,number) => {
    const text=normalizeTerminal(value); if(!text)return false;
    if(isTrainNumber(number))return /站$/.test(text);
    if(/(北京首都|上海浦东|上海虹桥|广州白云|成都双流|重庆江北|深圳宝安).*(机场)/.test(text)&&!/(T\d|航站楼)/i.test(text))return false;
    return /(机场|航站楼)/.test(text);
  };
  const locationCity = value => state.settings.allowedCities.find(city=>String(value||"").includes(city)) || String(value||"").replace(/(国际)?机场.*|[A-Z]?\d航站楼.*|站$/g,"").trim();

  function evaluateSegmentRisks(data) {
    const verification=data.customFields?._travelVerification||{};
    const result={outbound:[...(verification.outbound?.warnings||[])],return:[...(verification.return?.warnings||[])]};
    if (state.settings.mismatchRule && data.outFrom && data.returnTo && locationCity(data.outFrom) !== locationCity(data.returnTo)) result.return.push("去程出发城市与返程到达城市不一致");
    if (state.settings.departureRule && data.outFrom && !state.settings.allowedCities.some(city=>String(data.outFrom).includes(city))) result.outbound.push(`出发城市“${data.outFrom.trim()}”不在预设范围`);
    [["outbound","去程",data.outNo,data.outFrom,data.outTo,data.outDate,data.outDeparture,data.outArrival],["return","返程",data.returnNo,data.returnFrom,data.returnTo,data.returnDate,data.returnDeparture,data.returnArrival]].forEach(([segment,label,number,from,to,date,departure,arrival])=>{
      if(!number||!date||!departure||!arrival)result[segment].push(`${label}班次日期或起抵时间不完整`);
      if(from&&!isPreciseTerminal(from,number))result[segment].push(`${label}出发地点“${from}”需核验到具体${isTrainNumber(number)?"高铁站":"机场/航站楼"}`);
      if(to&&!isPreciseTerminal(to,number))result[segment].push(`${label}抵达地点“${to}”需核验到具体${isTrainNumber(number)?"高铁站":"机场/航站楼"}`);
    });
    return result;
  }
  const evaluateRisks = data => { const risks=evaluateSegmentRisks(data); return [...risks.outbound,...risks.return]; };
  function segmentApproval(a,segment) {
    const key=segment==="outbound"?"outboundApproval":"returnApproval"; if(a[key])return a[key];
    const hasRisk=evaluateSegmentRisks(a)[segment].length>0; return hasRisk?(a.approval==="approved"?"approved":"pending"):"normal";
  }
  function syncAggregateApproval(a) {
    const statuses=[segmentApproval(a,"outbound"),segmentApproval(a,"return")];
    a.approval=statuses.some(value=>["pending","rejected"].includes(value))?"pending":statuses.some(value=>value==="approved")?"approved":"normal";
  }
  function refreshTravelApprovals(a,changedSegments=null) {
    const previous={outbound:segmentApproval(a,"outbound"),return:segmentApproval(a,"return")}; const risks=evaluateSegmentRisks(a); a.risks=[...risks.outbound,...risks.return];
    a.outboundApproval=risks.outbound.length?(changedSegments&&!changedSegments.has("outbound")?previous.outbound:"pending"):"normal";
    a.returnApproval=risks.return.length?(changedSegments&&!changedSegments.has("return")?previous.return:"pending"):"normal"; syncAggregateApproval(a);
  }
  const approvalRequired = (a,segment) => evaluateSegmentRisks(a)[segment].length>0;
  function ticketApprovalBlockers(a) { return ["outbound","return"].filter(segment=>approvalRequired(a,segment)&&segmentApproval(a,segment)!=="approved"); }

  async function loadStaffAccess() {
    const {data,error}=await backend.rpc("get_staff_access");
    if(error)throw new Error("系统账号权限尚未升级，请先执行最新数据库升级");
    const row=Array.isArray(data)?data[0]:data;
    if(!row?.allowed)throw new Error("当前邮箱未开放管理系统权限");
    staffAccess={allowed:true,email:row.email||"",displayName:row.display_name||"",systemRole:row.system_role||"ops"};
    return staffAccess;
  }

  async function loadStaffDirectory() {
    staffDirectory = [];
    if (!backend || !backendMeetingId || !isSystemAdmin()) return;
    const { data, error } = await backend.rpc("list_system_staff", { p_meeting_id: backendMeetingId });
    if (error) throw new Error(`会务负责人账号读取失败：${error.message}`);
    staffDirectory = Array.isArray(data) ? data : [];
  }

  function renderSystemStaffDirectory() {
    const panel = $("#systemStaffPanel");
    const list = $("#systemStaffList");
    if (!panel || !list) return;
    const visible = !!backendMeetingId && isSystemAdmin();
    panel.classList.toggle("is-hidden", !visible);
    if (!visible) { list.innerHTML = ""; return; }
    list.innerHTML = staffDirectory.map(staff => {
      const isAdmin = staff.system_role === "super_admin";
      const enabled = isAdmin || !!staff.project_enabled;
      const accountState = staff.account_created ? "登录账号已创建" : "尚未创建登录账号";
      return `<div class="system-staff-row">
        <span class="system-staff-avatar ${isAdmin ? "admin" : ""}">${escapeHtml((staff.display_name || "人").slice(0,1))}</span>
        <div class="system-staff-main"><strong>${escapeHtml(staff.display_name)}</strong><small>${escapeHtml(staff.email)}</small></div>
        <div class="system-staff-badges"><span class="status ${staff.account_created ? "status-normal" : "status-locked"}">${accountState}</span>${isAdmin ? `<span class="status status-ok">全部项目 · 最高权限</span>` : ""}</div>
        ${isAdmin ? `<span class="system-staff-fixed">不可回收</span>` : `<label class="permission-switch system-staff-switch"><span><strong>${enabled ? "已授权当前项目" : "未授权当前项目"}</strong><small>${staff.account_created ? "可随时开放或回收" : "请先在 Supabase 创建账号"}</small></span><span class="switch"><input type="checkbox" data-system-staff-email="${escapeHtml(staff.email)}" ${enabled ? "checked" : ""} ${staff.account_created ? "" : "disabled"}/><span></span></span></label>`}
      </div>`;
    }).join("") || `<div class="empty-state">暂无可分配的会务负责人账号</div>`;
    $$('[data-system-staff-email]', list).forEach(input => input.addEventListener("change", () => toggleProjectStaff(input.dataset.systemStaffEmail, input.checked, input)));
  }

  async function toggleProjectStaff(email, enabled, input) {
    if (!backend || !backendMeetingId || !isSystemAdmin()) return deny();
    input.disabled = true;
    try {
      const { error } = await backend.rpc("set_project_staff_member", { p_meeting_id: backendMeetingId, p_email: email, p_enabled: enabled });
      if (error) throw error;
      await loadStaffDirectory();
      renderSystemStaffDirectory();
      toast(enabled ? "已开放当前项目权限" : "已回收当前项目权限");
    } catch (error) {
      input.checked = !enabled;
      input.disabled = false;
      toast(`账号权限更新失败：${error.message}`, "error");
    }
  }

  async function init() {
    bindLogin();
    const cleanUrl=new URL(location.href);if(cleanUrl.searchParams.has("preview")){cleanUrl.searchParams.delete("preview");history.replaceState(null,"",cleanUrl.toString());}
    const config = window.APP_CONFIG || {};
    if (config.mode === "production" && config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
      backend = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      const { data } = await backend.auth.getSession();
      if (data.session) {
        try{await loadStaffAccess();await loadBackendState();}
        catch(error){await backend.auth.signOut();staffAccess={allowed:false,email:"",displayName:"",systemRole:""};$("#loginError").textContent=error.message;$("#loginDialog").showModal();}
      }
      else if (!["portal", "lookup", "register", "manage"].includes((location.hash || "#dashboard").slice(1).split("?")[0])) $("#loginDialog").showModal();
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

  function updateProjectIdentifierLabel() {
    const internal = $("#projectActivityType").value === "internal"; const label = $("#projectIdentifierLabel");
    label.firstChild.textContent = internal ? "合同编号" : "会议编码"; label.querySelector("input").placeholder = internal ? "例如：HT2026-0188" : "例如：EL2026-0820";
  }

  function openProjectDialog(source = null, mode = "new") {
    const editing=mode==="edit"; const copying=mode==="copy"; const form=$("#projectForm"); form.reset();
    form.elements.editId.value=editing?source?.id||"":""; form.elements.activityType.value=source?.activityType||"external";
    form.elements.identifier.value=editing?source?.identifier||"":copying&&source?.identifier?`${source.identifier}-COPY`:"";
    form.elements.name.value=editing?source?.name||"":copying?`${source?.name||""}（复制）`:"";
    form.elements.activityOwner.value=source?.activityOwner||currentUser()?.name||""; form.elements.activityDate.value=source?.activityDate||new Date().toISOString().slice(0,10);
    form.elements.sourceId.value=copying?source?.id||"":""; form.elements.slug.value=editing?source?.slug||"":copying?`${source?.slug||"project"}-copy-${String(Date.now()).slice(-4)}`:""; form.elements.slug.dataset.edited=source?"1":"";
    $("#projectDialogTitle").textContent=editing?"编辑项目":"新建项目"; $("#projectDialogHint").textContent=editing?"修改项目基础资料，项目建档文件和行程数据保持不变":"创建后先完成项目建档文件，再开展报名与行程管理";
    $("#projectCopyField").classList.toggle("is-hidden",editing); $("#projectSubmitButton").textContent=editing?"保存项目修改":"创建项目并进入建档"; $("#projectFormError").textContent=""; updateProjectIdentifierLabel(); $("#projectDialog").showModal();
  }

  async function switchProject(projectId) {
    if (!projectId || projectId === state.activeProjectId) return;
    try {
      if (backend && backendMeetingId) await loadBackendState(projectId);
      else {
        const project = state.projects.find(item => item.id === projectId);
        if (!project) return;
        state.activeProjectId = projectId;
        state.settings = { ...state.settings, eventName:project.name, slug:project.slug, activityType:project.activityType||"external", identifier:project.identifier||project.slug, activityOwner:project.activityOwner||"", activityDate:project.activityDate||project.startDate||"", clientName:project.clientName||"", startDate:project.startDate||"", endDate:project.endDate||"", brandColor:project.brandColor||"#5267d9" };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
      populateUsers(); populateProjects(); renderAll(); location.hash = "dashboard"; toast(`已切换至${state.settings.eventName}`);
    } catch (error) { toast(`项目切换失败：${error.message}`, "error"); populateProjects(); }
  }

  async function createProject(event) {
    event.preventDefault();
    const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
    const editId=String(data.editId||""); const name = String(data.name||"").trim(); const slug = String(data.slug||"").trim().toLowerCase(); const activityType = data.activityType === "internal" ? "internal" : "external"; const identifier = String(data.identifier||"").trim(); const activityOwner = String(data.activityOwner||"").trim(); const activityDate = String(data.activityDate||"");
    $("#projectFormError").textContent = "";
    if (!name || !identifier || !activityOwner || !/^\d{4}-\d{2}-\d{2}$/.test(activityDate) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return $("#projectFormError").textContent = "请完整填写项目资料，并使用正确的链接标识";
    try {
      let projectId;
      if (backend) {
        if(editId){ const {error}=await backend.rpc("update_meeting_project",{p_id:editId,p_name:name,p_slug:slug,p_activity_type:activityType,p_identifier:identifier,p_activity_owner:activityOwner,p_activity_date:activityDate}); if(error)throw error; projectId=editId; }
        else { const { data:created,error } = await backend.rpc("create_meeting_project", { p_name:name, p_slug:slug, p_activity_type:activityType, p_identifier:identifier, p_activity_owner:activityOwner, p_activity_date:activityDate, p_source_id:data.sourceId||null }); if (error) throw error; projectId = created; }
        await loadBackendState(projectId);
      } else {
        if (state.projects.some(project => project.slug === slug)) throw new Error("项目编号已存在");
        projectId = `demo-${Date.now()}`;
        const source = state.projects.find(project => project.id === data.sourceId);
        state.projects.push({ id:projectId, slug, name, activityType, identifier, activityOwner, activityDate, clientName:source?.clientName||"", role:"ops", attendeeCount:0, startDate:source?.startDate||activityDate, endDate:source?.endDate||activityDate, brandColor:source?.brandColor||"#5267d9" });
        state.activeProjectId = projectId; state.settings = { ...initialState().settings, ...(source ? state.settings : {}), eventName:name, slug, activityType, identifier, activityOwner, activityDate };
        state.attendees = []; state.notifications = []; state.locks = {master:false,columns:[],rows:[]}; localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      }
      if (backend) await syncDocumentProject().catch(error => toast(`项目建档初始化失败：${error.message}`, "error"));
      await loadProjectArchiveStates(); form.reset(); $("#projectDialog").close(); populateUsers(); populateProjects(); renderAll(); location.hash = editId?"projects":"documents"; toast(editId?"项目资料已更新":"项目已创建，请先上传报价和待签署会务确认单");
    } catch (error) { $("#projectFormError").textContent = error.message.includes("duplicate") ? "项目编号已存在，请更换" : error.message; }
  }

  function bindLogin() {
    $("#loginForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (!backend) return;
      const form = event.currentTarget;
      const button=form.querySelector('button[type="submit"]');button.disabled=true;
      const email=String(form.elements.email.value||"").trim().toLowerCase();
      const { error } = await backend.auth.signInWithPassword({ email, password: form.elements.password.value });
      if (error) { $("#loginError").textContent = "邮箱或密码不正确"; button.disabled=false; return; }
      try{$("#loginError").textContent="";await loadStaffAccess();await loadBackendState();populateUsers();populateProjects();renderAll();$("#loginDialog").close();location.hash=state.activeProjectId?"dashboard":"projects";route();toast(state.activeProjectId?`登录成功 · ${isSystemAdmin()?"超级管理员":"会务负责人"}`:"登录成功，请先新建项目");}
      catch(accessError){await backend.auth.signOut();staffAccess={allowed:false,email:"",displayName:"",systemRole:""};$("#loginError").textContent=accessError.message||"当前邮箱未开放管理系统权限";}
      finally{button.disabled=false;}
    });
  }

  async function loadBackendState(preferredMeetingId = null) {
    const { data: authData } = await backend.auth.getUser();
    if (!authData.user) throw new Error("登录已过期");
    const [profileRes,projectsRes]=await Promise.all([backend.from("profiles").select("display_name,phone,role").eq("user_id",authData.user.id).maybeSingle(),backend.from("meetings").select("*").order("created_at",{ascending:false})]);
    if(profileRes.error||!profileRes.data)throw new Error("当前账号尚未建立人员资料"); if(projectsRes.error)throw new Error("请先运行项目权限数据库升级脚本");
    const manageableProjects=projectsRes.data||[]; projectMemberships=manageableProjects.map(meeting=>({meeting_id:meeting.id,role:"ops",display_name:profileRes.data.display_name,phone:profileRes.data.phone,meetings:meeting}));
    if (!manageableProjects.length) {
      const blank = initialState(); backendMeetingId = null;
      state = { ...blank, currentUserId:authData.user.id, activeProjectId:null, projects:[], users:[{id:authData.user.id,name:profileRes.data.display_name,role:"ops",label:isSystemAdmin()?"超级管理员":"会务负责人",phone:profileRes.data.phone||""}], attendees:[], notifications:[], locks:{master:false,columns:[],rows:[]} };
      localStorage.removeItem("journey-desk-active-project"); return;
    }
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
      projects: projectMemberships.map(item => { const m = item.meetings || {}; return { id:item.meeting_id, slug:m.slug, name:m.name, activityType:m.activity_type||"external", identifier:m.project_identifier||m.slug, activityOwner:m.activity_owner||"", activityDate:m.activity_date||m.start_date||"", clientName:m.client_name||"", role:"ops", ownerUserId:m.owner_user_id||null, archiveReady:!!m.archive_ready, registrationOpen:!!m.registration_open, templateImported:!!m.template_imported_at, managerEditEnabled:!!m.manager_attendee_edit_enabled, startDate:m.start_date||"", endDate:m.end_date||"", brandColor:m.brand_color||"#5267d9" }; }),
      users: membersRes.data.map(p => ({ id:p.user_id, name:p.display_name, role:p.role, label:({ops:"会务负责人",client:"会议负责人（客户）",sales:"销售负责人"})[p.role], phone:p.phone||"" })),
      settings: { eventName:meeting.name, slug:meeting.slug, activityType:meeting.activity_type||"external", identifier:meeting.project_identifier||meeting.slug, activityOwner:meeting.activity_owner||"", activityDate:meeting.activity_date||meeting.start_date||"", clientName:meeting.client_name||"", startDate:meeting.start_date||"", endDate:meeting.end_date||"", venues:[...new Set((meeting.venues||[]).map(normalizeVenueLabel).filter(Boolean))], servicePhone:meeting.service_phone||"", brandColor:meeting.brand_color||"#5267d9", deadline:meeting.deadline?.slice(0,16)||"", capacity:meeting.capacity, allowedCities:meeting.allowed_departure_cities||[], mismatchRule:meeting.check_city_mismatch, departureRule:meeting.check_departure_city, flightLeadMinutes:meeting.flight_lead_minutes??120, trainLeadMinutes:meeting.train_lead_minutes??90, transportGroupMinutes:meeting.transport_group_minutes??30, fieldConfig:{title:true,hcpId:true,accommodation:true,flight:true,mslContact:true,remarks:true,...(meeting.field_config||{})}, registrationQuotas:Array.isArray(meeting.field_config?.registrationQuotas)?meeting.field_config.registrationQuotas:[], quotaRegions:Array.isArray(meeting.field_config?.quotaRegions)?meeting.field_config.quotaRegions:[], templateName:meeting.template_name||"", registrationTemplate:meeting.registration_template?.columns?.length ? meeting.registration_template : {version:1,columns:[]}, templateImported:!!meeting.template_imported_at, registrationOpen:!!meeting.registration_open, managerEditEnabled:!!meeting.manager_attendee_edit_enabled },
      locks: { master: meeting.master_locked, columns: locksRes.data.filter(l => l.locked).map(l => l.field_group), rows: attendeesRes.data.filter(a => a.row_locked).map(a => a.id) },
      attendees: attendeesRes.data.map(fromDbAttendee),
      notifications: noticesRes.data.map(n => ({ id: n.id, type: n.type, text: n.message, time: n.created_at, read: !!n.read_at })),
    };
    if (!state.users.some(user => user.id === authData.user.id)) {
      const profileName=profileRes.data.display_name?.trim();
      state.users.push({id:authData.user.id,name:profileName,role:"ops",label:isSystemAdmin()?"超级管理员":"会务负责人",phone:profileRes.data.phone||""});
    } else {
      const signedInUser=state.users.find(user=>user.id===authData.user.id);signedInUser.role="ops";signedInUser.label=isSystemAdmin()?"超级管理员":"会务负责人";
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    await loadProjectArchiveStates();
    await loadStaffDirectory();
  }

  function fromDbAttendee(row) {
    const trip = direction => {
      const t = row.transports?.find(item => item.direction === direction) || {};
      return { driver: t.driver_name || "待分配", staffName:t.staff_name||"", phone: t.driver_phone || "—", vehicle: t.vehicle || "待分配", time: t.service_time ? new Date(t.service_time).toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-") : "待设置", point: t.meeting_point || "待设置", mode:t.service_mode||"", batchId:t.batch_id||"", batchName:t.batch_name||"", terminal:t.terminal||"", placard:t.placard||"", capacity:t.capacity||null, notes:t.notes||"", timeStrategy:t.time_strategy||"fixed" };
    };
    return { id:row.id, attendeeType:row.attendee_type||"", name:row.name, city:row.city||"", hospital:row.hospital||"", department:row.department||"", title:row.title||"", venue:normalizeVenueLabel(row.venue), sex:row.sex||"", idNumber:row.id_number, phone:row.phone, hcpId:row.hcp_id, accommodation:row.accommodation?"Y":"N", flight:row.is_flight?"Y":"N", region:row.region||"", contactName:row.contact_name||"", contactMobile:row.contact_mobile||"", mslContact:row.msl_contact||"", remarks:row.remarks||"", customFields:row.custom_fields||{}, privacyLetterStatus:normalizePrivacyStatus(row.privacy_letter_status), privacyLetterFilePath:row.privacy_letter_file_path||"", privacyLetterFileName:row.privacy_letter_file_name||"", privacyLetterFileSize:Number(row.privacy_letter_file_size)||0, privacyLetterUploadedAt:row.privacy_letter_uploaded_at||"", privacyLetterUploadedBy:row.privacy_letter_uploaded_by||null, ticketStatus:row.ticket_status||"pending", outboundApproval:row.outbound_approval_status||"", returnApproval:row.return_approval_status||"", ownerId:row.owner_id, registrantId:row.registrant_id||null, businessStatus:row.business_status||"active", outDate:row.out_date||"", outFrom:row.out_from||"", outTo:row.out_to||"", outNo:row.out_no||"", outDeparture:(row.out_departure||"").slice(0,5), outArrival:(row.out_arrival||"").slice(0,5), returnDate:row.return_date||"", returnFrom:row.return_from||"", returnTo:row.return_to||"", returnNo:row.return_no||"", returnDeparture:(row.return_departure||"").slice(0,5), returnArrival:(row.return_arrival||"").slice(0,5), approval:row.approval, risks:row.risks||[], createdAt:row.created_at, transport:{pickup:trip("pickup"),dropoff:trip("dropoff")} };
  }

  function toDbAttendee(a) {
    return { id:a.id, meeting_id:backendMeetingId, owner_id:a.ownerId, registrant_id:a.registrantId||null, business_status:a.businessStatus||"active", attendee_type:a.attendeeType||null, name:a.name, city:a.city||null, hospital:a.hospital||null, department:a.department||null, title:a.title||null, venue:normalizeVenueLabel(a.venue)||null, sex:a.sex||null, id_number:a.idNumber, phone:a.phone, hcp_id:a.hcpId, accommodation:a.accommodation==="Y", is_flight:a.flight==="Y", out_date:dbDate(a.outDate), out_from:a.outFrom||null, out_to:a.outTo||null, out_no:a.outNo||null, out_departure:dbTime(a.outDeparture), out_arrival:dbTime(a.outArrival), return_date:dbDate(a.returnDate), return_from:a.returnFrom||null, return_to:a.returnTo||null, return_no:a.returnNo||null, return_departure:dbTime(a.returnDeparture), return_arrival:dbTime(a.returnArrival), region:a.region||null, contact_name:a.contactName||null, contact_mobile:a.contactMobile||null, msl_contact:a.mslContact||null, remarks:a.remarks||null, custom_fields:a.customFields||{}, privacy_letter_status:normalizePrivacyStatus(a.privacyLetterStatus), privacy_letter_file_path:a.privacyLetterFilePath||null, privacy_letter_file_name:a.privacyLetterFileName||null, privacy_letter_file_size:a.privacyLetterFileSize||null, privacy_letter_uploaded_at:a.privacyLetterUploadedAt||null, privacy_letter_uploaded_by:a.privacyLetterUploadedBy||null, ticket_status:a.ticketStatus||"pending", outbound_approval_status:segmentApproval(a,"outbound"), return_approval_status:segmentApproval(a,"return"), approval:a.approval, risks:a.risks||[], row_locked:state.locks.rows.includes(a.id) };
  }

  async function syncBackend() {
    if (!backend || !backendMeetingId) return;
    const attendeeRows = state.attendees.map(toDbAttendee);
    if (attendeeRows.length&&canEditAttendeeData()) { const { error } = await backend.from("attendees").upsert(attendeeRows); if (error) throw error; }
    const transportRows = state.attendees.flatMap(a => ["pickup","dropoff"].map(direction => { const t = a.transport?.[direction] || {}; return { attendee_id:a.id, direction, driver_name:t.driver||null, staff_name:t.staffName||null, driver_phone:t.phone||null, vehicle:t.vehicle||null, service_time:parseServiceTime(t.time), meeting_point:t.point||null, service_mode:t.mode||null, batch_id:t.batchId||null, batch_name:t.batchName||null, terminal:t.terminal||null, placard:t.placard||null, capacity:t.capacity||null, notes:t.notes||null, time_strategy:t.timeStrategy||null }; }));
    if (transportRows.length) { const { error } = await backend.from("transports").upsert(transportRows,{onConflict:"attendee_id,direction"}); if (error) throw error; }
    if (canManage()) {
      const { error } = await backend.from("meetings").update({ name:state.settings.eventName, activity_type:state.settings.activityType||"external", project_identifier:state.settings.identifier||state.settings.slug, activity_owner:state.settings.activityOwner||null, activity_date:state.settings.activityDate||state.settings.startDate||null, client_name:state.settings.clientName||null, start_date:state.settings.startDate||null, end_date:state.settings.endDate||null, venues:state.settings.venues, service_phone:state.settings.servicePhone||null, brand_color:state.settings.brandColor, deadline:state.settings.deadline||null, capacity:state.settings.capacity, allowed_departure_cities:state.settings.allowedCities, check_city_mismatch:state.settings.mismatchRule, check_departure_city:state.settings.departureRule, flight_lead_minutes:state.settings.flightLeadMinutes, train_lead_minutes:state.settings.trainLeadMinutes, transport_group_minutes:state.settings.transportGroupMinutes||30, field_config:{...state.settings.fieldConfig,registrationQuotas:state.settings.registrationQuotas||[],quotaRegions:state.settings.quotaRegions||[]}, template_name:state.settings.templateName||null, registration_template:state.settings.registrationTemplate||standardTemplate(), master_locked:state.locks.master }).eq("id",backendMeetingId); if (error) throw error;
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
    const isPublic = ["portal", "lookup", "register", "manage"].includes(target);
    $("#adminApp").classList.toggle("is-hidden", isPublic);
    $("#publicPortalView").classList.toggle("is-hidden", !isPublic);
    if (isPublic) { setPortalTab(target === "lookup" ? "lookup" : target === "manage" ? "manage" : "register"); if (!publicProjectConfig || Date.now()-publicProjectLoadedAt>5000) loadPublicProjectInfo(); scrollTo({ top: 0, behavior: "instant" }); return; }
    const requestedRoute = $( `[data-page="${target}"]`) ? target : "dashboard"; const gatedRoutes=new Set(["dashboard","registration","attendees","approvals","transport"]); let routeName = !state.activeProjectId && requestedRoute !== "projects" ? "projects" : requestedRoute;
    if(state.activeProjectId&&gatedRoutes.has(routeName)&&!activeManagementOpen())routeName="documents";
    if (routeName !== requestedRoute) { history.replaceState(null,"",state.activeProjectId?"#documents":"#projects"); toast(state.activeProjectId?"请先在项目管理中完成项目建档文件，再继续报名和行程管理":"请先新建项目，再进行报名和行程管理", "error"); }
    $$(".page").forEach(page => page.classList.toggle("active", page.dataset.page === routeName));
    $$("[data-route]").forEach(link => link.classList.toggle("active", link.dataset.route === routeName));
    scrollTo({ top: 0, behavior: "instant" });
    renderAll();
    if (routeName === "documents") loadDocuments();
    if (routeName === "projects") loadProjectArchiveStates();
  }

  function bindForms() {
    $("#registrationForm").addEventListener("input", updateLiveRisk);
    $("#registrationForm").addEventListener("submit", submitRegistration);
    $("#publicRegistrationForm").addEventListener("submit", submitPublicRegistration);
    $("#publicManageForm").addEventListener("submit", submitPublicRegistration);
    $("#publicFullRegistrationForm").addEventListener("submit", submitPublicFullRegistration);
    $("#lookupForm").addEventListener("submit", queryTransport);
    $("#settingsForm").addEventListener("submit", saveSettings);
    $("#projectForm").addEventListener("submit", createProject);
    $("#documentUploadForm").addEventListener("submit", uploadDocument);
    $("#transportBatchForm").addEventListener("submit", saveTransportBatch);
    $("#quotaForm").addEventListener("submit", saveQuotaConfiguration);
  }

  function bindControls() {
    $("#projectSelect").addEventListener("change", event => switchProject(event.target.value));
    $("#newProjectButton").addEventListener("click", () => openProjectDialog());
    $("#projectActivityType").addEventListener("change", updateProjectIdentifierLabel);
    $("#documentScenario").addEventListener("change", updateDocumentTypeOptions);
    $("#refreshDocuments").addEventListener("click", loadDocuments);
    $("#documentFile").addEventListener("change", event => $("#documentFileName").textContent = event.target.files[0]?.name || "单个文件最大 50MB");
    $("#projectForm").elements.name.addEventListener("input", event => { const slug=$("#projectForm").elements.slug; if (!slug.dataset.edited) slug.value = `project-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(Date.now()).slice(-4)}`; });
    $("#projectForm").elements.slug.addEventListener("input", event => event.target.dataset.edited = event.target.value ? "1" : "");
    $("#userSelect").addEventListener("change", event => { state.currentUserId = event.target.value; saveState(); renderAll(); toast(`已切换为${currentUser().label}`); });
    $("#attendeeSearch").addEventListener("input", renderAttendeeTable);
    $("#riskFilter").addEventListener("change", renderAttendeeTable);
    $("#venueFilter").addEventListener("change", renderAttendeeTable);
    $("#toggleIncompleteFilter").addEventListener("click",()=>{incompleteRosterOnly=!incompleteRosterOnly;renderAttendeeTable();});
    $("#toggleCancelledRoster").addEventListener("click",()=>{cancelledRosterView=!cancelledRosterView;selectedAttendeeIds.clear();renderAttendeeTable();});
    $("#deleteSelectedAttendees").addEventListener("click",deleteSelectedAttendees);
    $("#transportSearch").addEventListener("input", renderTransport);
    $("#newPickupBatch").addEventListener("click", () => openTransportBatch("pickup"));
    $("#newDropoffBatch").addEventListener("click", () => openTransportBatch("dropoff"));
    $("#autoArrangeTransport").addEventListener("click", autoArrangeTransport);
    $("#cancelTransportBatch").addEventListener("click", () => $("#transportBatchDialog").close());
    ["serviceDate","terminal","timeStrategy"].forEach(name => $("#transportBatchForm").elements[name].addEventListener("input", renderBatchCandidates));
    $("#transportBatchForm").elements.capacity.addEventListener("input",updateBatchCapacityNotice);
    $("#batchTransportMode").addEventListener("change", toggleBatchModeFields);
    $("#selectAllBatchAttendees").addEventListener("change", event => { $$('[name="batchAttendee"]',$("#batchAttendeeList")).forEach(input=>input.checked=event.target.checked); updateBatchCapacityNotice(); });
    $$('[data-transport-filter]').forEach(button => button.addEventListener("click", () => { activeTransportFilter = button.dataset.transportFilter; $$('[data-transport-filter]').forEach(b => b.classList.toggle("active", b === button)); renderTransport(); }));
    $("#exportExcel").addEventListener("click", exportExcel);
    $("#transferRegistrant").addEventListener("click", openRegistrantTransfer);
    $("#transferRegistrantForm").addEventListener("submit", submitRegistrantTransfer);
    $("#auditTravel").addEventListener("click", auditRosterTravel);
    $("#importRoster").addEventListener("click", openRosterImport);
    $("#rosterFile").addEventListener("change", event => readRosterFile(event.target.files[0]));
    $("#projectTemplateFile").addEventListener("change", event => readProjectTemplate(event.target.files[0]));
    $("#resetProjectTemplate").addEventListener("click", resetProjectTemplate);
    $("#registrationOpenSwitch").addEventListener("change", toggleRegistrationOpen);
    $("#managerEditSwitch").addEventListener("change", toggleManagerEdit);
    $("#confirmImport").addEventListener("click", confirmRosterImport);
    $("#cancelImport").addEventListener("click", () => $("#importDialog").close());
    const dropzone=$("#importDropzone");
    ["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add("dragging");}));
    ["dragleave","drop"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove("dragging");}));
    dropzone.addEventListener("drop",event=>readRosterFile(event.dataTransfer.files[0]));
    $("#markAllRead").addEventListener("click", async () => { state.notifications.forEach(n => n.read = true); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); if (backend && backendMeetingId) await backend.from("notifications").update({read_at:new Date().toISOString()}).eq("meeting_id",backendMeetingId).is("read_at",null); renderNotifications(); renderCounts(); });
    $("#masterLock").addEventListener("change", event => { if (!canManage()) return deny(); state.locks.master = event.target.checked; addNotification("lock", `${currentUser().name}${event.target.checked ? "锁定" : "解锁"}了全部名单`); saveState(); renderAll(); });
    $("#copyRegistrationLink").addEventListener("click", copyRegistrationLink);
    $("#configureQuotas").addEventListener("click", openQuotaConfiguration);
    $("#editQuotasFromSettings").addEventListener("click", openQuotaConfiguration);
    $("#quotaRoleFilter").addEventListener("change",event=>{activeQuotaRole=event.target.value;renderRegistrationProgress();});
    $("#addQuotaRow").addEventListener("click",()=>appendQuotaConfigRow());
    $("#quotaRegionPresets").addEventListener("input",event=>renderQuotaRegionOptions(parseQuotaRegions(event.target.value)));
    $("#cancelQuotaConfig").addEventListener("click",()=>$("#quotaDialog").close());
    $("#downloadQr").addEventListener("click", downloadQr);
    $("#backToPublicAuth").addEventListener("click", closePublicAttendeeEditor);
    $("#newPublicAttendee").addEventListener("click", () => openPublicAttendeeEditor());
    $$('[data-portal-tab]').forEach(button => button.addEventListener("click", () => { location.hash = button.dataset.portalTab === "lookup" ? "lookup" : button.dataset.portalTab === "manage" ? "manage" : "portal"; }));
    const refreshPublicProject=()=>{const routeName=(location.hash||"").slice(1).split("?")[0];if(["portal","register","manage","lookup"].includes(routeName)&&!publicAuthSession&&Date.now()-publicProjectLoadedAt>3000)loadPublicProjectInfo();};
    window.addEventListener("focus",refreshPublicProject);
    window.addEventListener("pageshow",refreshPublicProject);
    window.addEventListener("online",refreshPublicProject);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshPublicProject();});
    $("#resetDemo").addEventListener("click", () => { if (!confirm("确认恢复全部演示数据？")) return; state = initialState(); saveState(); populateUsers(); populateProjects(); renderAll(); toast("已恢复演示数据"); });
  }

  function setPortalTab(tab) {
    if(publicAuthSession&&tab!==publicAuthSession.mode)resetPublicRegistrationStep();
    $(".portal-card")?.classList.remove("workspace-mode");
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
    renderRegistrationOwner(); renderCounts(); renderDashboard(); renderAttendeeTable(); renderApprovals(); renderTransport(); renderLocks(); renderNotifications(); renderSettings(); renderProjects(); renderDocuments(); renderQr();
  }

  function renderProjects() {
    $("#projectGrid").innerHTML = state.projects.map(project => {
      const active = project.id === state.activeProjectId; const role = project.ownerUserId===state.currentUserId?"我的项目":isSystemAdmin()?"管理员可管理":"项目负责人"; const visual=projectVisual(project); const archive=projectArchiveStates[project.id]||{ready:!!project.archiveReady};
      const managementOpen=project.registrationOpen||archive.ready;
      return `<article class="panel project-card ${active ? "active" : ""}" style="--project-color:${visual.color}"><div class="project-card-top"><span class="project-card-icon">${visual.icon}</span><span class="status ${active ? "status-normal" : ""}">${active ? "当前项目" : escapeHtml(role)}</span></div><h2>${escapeHtml(project.name)}</h2><p>${project.activityType === "internal" ? "内部活动 · 合同编号" : "外部活动 · 会议编码"}：${escapeHtml(project.identifier||project.slug)}</p><p>${escapeHtml(project.activityOwner||"负责人待补充")} · ${escapeHtml(project.activityDate||project.startDate||"日期待定")}</p><div class="project-archive-state ${managementOpen?"ready":"pending"}"><b>${project.registrationOpen?"报名开关已开启":archive.ready?"沿用建档开放规则":"报名与管理尚未开放"}</b><span>${project.registrationOpen?"允许新增报名；修改和查询正常可用":archive.ready?"管理模块可用，公开新增报名仍由开关控制":"需先导入模板后开启报名，或完成项目建档"}</span></div><label class="project-registration-switch"><span><strong>报名开放</strong><small>${project.templateImported?"人工控制新增报名":"请先导入报名模板"}</small></span><span class="switch"><input type="checkbox" data-project-registration-open="${project.id}" ${project.registrationOpen?"checked":""} ${!project.templateImported&&!project.registrationOpen?"disabled":""}/><span></span></span></label><small>公开入口：?event=${escapeHtml(project.slug)}</small><div class="project-actions"><button class="button button-primary" data-switch-project="${project.id}" ${active ? "disabled" : ""}>${active ? "正在使用" : "进入项目"}</button><button class="button button-secondary" data-project-documents="${project.id}">项目建档文件</button><button class="text-button" data-edit-project="${project.id}">编辑</button><button class="text-button danger" data-delete-project="${project.id}">删除</button><button class="text-button" data-copy-project="${project.id}">复制</button><button class="text-button" data-copy-project-link="${project.id}">复制入口</button></div></article>`;
    }).join("");
    $$('[data-switch-project]').forEach(button => button.onclick = () => switchProject(button.dataset.switchProject));
    $$('[data-project-documents]').forEach(button=>button.onclick=async()=>{if(button.dataset.projectDocuments!==state.activeProjectId)await switchProject(button.dataset.projectDocuments);location.hash="documents";});
    $$('[data-edit-project]').forEach(button=>button.onclick=()=>openProjectDialog(state.projects.find(item=>item.id===button.dataset.editProject),"edit"));
    $$('[data-delete-project]').forEach(button=>button.onclick=()=>deleteProject(button.dataset.deleteProject));
    $$('[data-copy-project]').forEach(button => button.onclick = () => openProjectDialog(state.projects.find(item=>item.id===button.dataset.copyProject),"copy"));
    $$('[data-copy-project-link]').forEach(button => button.onclick = () => { const project=state.projects.find(item=>item.id===button.dataset.copyProjectLink); const url=new URL(location.href); url.searchParams.set("event",project.slug); url.hash="portal"; navigator.clipboard?.writeText(url.toString()).then(()=>toast("项目入口已复制")).catch(()=>toast(url.toString())); });
    $$('[data-project-registration-open]').forEach(input=>input.onchange=()=>toggleProjectRegistration(input.dataset.projectRegistrationOpen,input.checked,input));
  }

  async function toggleProjectRegistration(projectId, enabled, control=null) {
    const project=state.projects.find(item=>item.id===projectId); if(!project)return;
    if(enabled&&!project.templateImported){if(control)control.checked=false;return toast("请先进入项目并导入报名表模板","error");}
    if(control)control.disabled=true;
    try{
      if(backend){const{error}=await backend.rpc("set_registration_open",{p_meeting_id:projectId,p_open:enabled});if(error)throw error;}
      project.registrationOpen=enabled;
      if(projectId===state.activeProjectId)state.settings.registrationOpen=enabled;
      saveState();renderProjects();renderSettings();route();toast(enabled?"报名开关已开启，可新增报名":"报名开关已关闭，已报名修改和查询不受影响");
    }catch(error){if(control)control.checked=!enabled;toast(error.message||"报名开关更新失败","error");}
    finally{if(control)control.disabled=false;}
  }
  function toggleRegistrationOpen(event){toggleProjectRegistration(state.activeProjectId,event.target.checked,event.target);}

  async function toggleManagerEdit(event){
    const enabled=event.target.checked;event.target.disabled=true;
    try{
      if(backend){const{error}=await backend.rpc("set_manager_attendee_edit",{p_meeting_id:backendMeetingId,p_enabled:enabled});if(error)throw error;}
      state.settings.managerEditEnabled=enabled;const project=currentProject();if(project)project.managerEditEnabled=enabled;saveState();renderSettings();toast(enabled?"管理员参会资料编辑权限已开启":"管理员已恢复为只读权限");
    }catch(error){event.target.checked=!enabled;toast(error.message||"权限更新失败","error");}
    finally{event.target.disabled=false;}
  }

  async function openRegistrantTransfer(){
    if(!backend)return toast("填报人移交仅在正式环境可用","error");
    if(!canManage()&&!isSystemAdmin())return deny();
    const dialog=$("#transferRegistrantDialog"),form=$("#transferRegistrantForm"),errorBox=$("#transferRegistrantError");errorBox.textContent="";
    const{data,error}=await backend.from("registrants").select("id,display_name,employee_no,region,active").eq("meeting_id",backendMeetingId).eq("active",true).order("display_name");
    if(error)return toast(error.message,"error");
    if(!data?.length)return toast("当前项目还没有可移交的填报人","error");
    const options=data.map(item=>`<option value="${item.id}">${escapeHtml(item.display_name)} · ${escapeHtml(item.employee_no)} · ${escapeHtml(item.region)}</option>`).join("");
    form.elements.fromRegistrant.innerHTML=`<option value="">请选择原填报人</option>${options}`;form.elements.toRegistrant.innerHTML=`<option value="">请选择新填报人</option>${options}`;dialog.showModal();
  }
  async function submitRegistrantTransfer(event){
    event.preventDefault();const form=event.currentTarget,errorBox=$("#transferRegistrantError"),button=form.querySelector('button[type="submit"]');const data=Object.fromEntries(new FormData(form));
    if(!data.fromRegistrant||!data.toRegistrant||data.fromRegistrant===data.toRegistrant){errorBox.textContent="请选择不同的原填报人和新填报人";return;}
    if(!confirm("确认移交？移交后旧填报人将立即失去这些参会人员的操作权限。"))return;
    button.disabled=true;errorBox.textContent="";
    try{const{data:count,error}=await backend.rpc("transfer_registrant_attendees",{p_meeting_id:backendMeetingId,p_from_registrant:data.fromRegistrant,p_to_registrant:data.toRegistrant});if(error)throw error;$("#transferRegistrantDialog").close();await loadBackendState(backendMeetingId);renderAll();toast(`已移交 ${count||0} 条参会人员数据`);}catch(error){errorBox.textContent=error.message||"移交失败";}finally{button.disabled=false;}
  }

  async function documentApi(path, options = {}) {
    if (!backend) throw new Error("项目建档文件仅在正式登录模式下使用");
    const { data } = await backend.auth.getSession(); const token = data.session?.access_token;
    if (!token) throw new Error("登录已过期，请重新登录");
    const response = await fetch(`${DOCUMENT_API_BASE}${path}`, { ...options, headers:{ Authorization:`Bearer ${token}`, ...(options.headers||{}) } });
    if (options.download && response.ok) return response;
    const payload = (response.headers.get("content-type")||"").includes("application/json") ? await response.json() : {};
    if (!response.ok) throw new Error(payload.error || "文件服务暂时不可用");
    return payload;
  }

  async function loadProjectArchiveStates() {
    if(!backend||!state.projects.length)return; const {data}=await backend.auth.getSession(); const token=data.session?.access_token; if(!token)return;
    const entries=await Promise.all(state.projects.map(async project=>{try{const response=await fetch(`${DOCUMENT_API_BASE}/api/integrated/projects/${project.id}/documents`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)return[project.id,{ready:!!project.archiveReady}];const payload=await response.json();const summary=archiveSummary(payload.files);if(project.id===backendMeetingId)documentState={folder:payload.folder||null,files:payload.files||[],user:payload.user||null,loading:false};return[project.id,{...summary,folder:payload.folder||null}];}catch{return[project.id,{ready:!!project.archiveReady}];}}));
    projectArchiveStates=Object.fromEntries(entries); renderProjects();
  }

  async function deleteProject(projectId){
    const project=state.projects.find(item=>item.id===projectId); if(!project||!confirm(`确认删除项目“${project.name}”？项目资料、报名名单、行程和归档文件都将删除，无法恢复。`))return;
    try{await documentApi(`/api/integrated/projects/${projectId}`,{method:"DELETE"});const{error}=await backend.rpc("delete_meeting_project",{p_id:projectId});if(error)throw error;delete projectArchiveStates[projectId];const next=state.projects.find(item=>item.id!==projectId)?.id||null;await loadBackendState(next);populateUsers();populateProjects();renderAll();location.hash="projects";toast("项目已删除");}catch(error){toast(`删除失败：${error.message}`,"error");}
  }

  async function syncDocumentProject() {
    if (!backend || !backendMeetingId) return null;
    return documentApi(`/api/integrated/projects/${backendMeetingId}/sync`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ meetingType:state.settings.activityType||"external", identifier:state.settings.identifier||state.settings.slug, activityName:state.settings.eventName, owner:state.settings.activityOwner||currentUser().name, date:state.settings.activityDate||state.settings.startDate }) });
  }

  async function loadDocuments() {
    if (!backendMeetingId) return renderDocuments("请先新建并进入一个项目");
    documentState.loading = true; renderDocuments();
    try {
      let payload = await documentApi(`/api/integrated/projects/${backendMeetingId}/documents`);
      if (!payload.folder && canManage()) payload = await syncDocumentProject();
      documentState = { folder:payload.folder||null, files:payload.files||[], user:payload.user||null, loading:false }; projectArchiveStates[backendMeetingId]={...archiveSummary(documentState.files),folder:documentState.folder}; renderDocuments();
    } catch (error) { documentState.loading = false; renderDocuments(error.message); }
  }

  function updateDocumentTypeOptions() {
    const admin = isDocumentAdmin(); const scenario = $("#documentScenario").value;
    const options = !admin ? [["quotation","报价"],["confirmation_pending","会务确认单（待签署）"]]
      : scenario === "po_email" ? [["quotation","报价"],["confirmation_pending","会务确认单（待签署）"],["po","采购订单（PO）"],["po_email","供应商PO确认邮件"],["other","其他"]]
      : scenario === "signed_confirmation" ? [["quotation","报价"],["confirmation_pending","会务确认单（待签署）"],["confirmation_signed","会务确认单（已签署）"],["po","采购订单（PO）"],["other","其他"]]
      : [["","请先选择项目场景"]];
    $("#documentType").innerHTML = options.map(([value,label])=>`<option value="${value}">${label}</option>`).join("");
    $("#documentScenarioField").classList.toggle("is-hidden", !admin);
    $("#documentRoleHint").textContent = admin ? (scenario === "po_email" ? "场景一：需归档 PO 和供应商PO确认邮件。" : scenario === "signed_confirmation" ? "场景二：需归档 PO 和已签署会务确认单。" : "管理员上传前请选择项目场景。") : "成员可上传报价和未签署会务确认单，最终采购材料由季亮亮上传。";
  }

  function renderDocuments(message = "") {
    const files = documentState.files || []; const folder = documentState.folder; const prerequisite=archiveSummary(files); const hasPo = files.some(file=>file.type==="po"); const hasEmail = files.some(file=>file.type==="po_email"); const hasSigned = files.some(file=>file.type==="confirmation"&&file.documentStatus==="signed"); const scenario = folder?.complianceScenario || "unclassified";
    if ($("#navDocumentCount")) $("#navDocumentCount").textContent = files.length;
    $("#documentProjectLabel").textContent = currentProject().identifier || currentProject().slug || "未选择项目";
    const finalReady = scenario === "po_email" ? hasEmail : scenario === "signed_confirmation" ? hasSigned : false;
    $("#documentStatusGrid").innerHTML = [
      [folder?"complete":"warning","项目归档",folder?"已关联":"待初始化",folder?.name||"项目创建后自动建立归档"],
      [prerequisite.quotation?"complete":"warning","报价",prerequisite.quotation?"已上传":"待上传",prerequisite.ready?"前置归档已完成":"完成后才能开放后续功能"],
      [prerequisite.pendingConfirmation?"complete":"warning","会务确认单（待签署）",prerequisite.pendingConfirmation?"已上传":"待上传",prerequisite.ready?"报名与行程已开放":"完成后才能开放后续功能"],
      [hasPo?"complete":"warning","采购订单（PO）",hasPo?"已上传":"待上传",hasPo?"采购订单已归档":"管理员补充最终采购订单"],
      [finalReady?"complete":"warning",scenario==="po_email"?"供应商PO确认邮件":"已签署会务确认单",finalReady?"已完成":scenario==="unclassified"?"场景待选择":"待上传",scenario==="unclassified"?"管理员上传时选择场景一或场景二":"按当前场景核对最终材料"],
    ].map(([cls,label,value,note])=>`<article class="document-status-card ${cls}"><small>${label}</small><strong>${value}</strong><span>${escapeHtml(note)}</span></article>`).join("");
    if (documentState.loading) $("#documentList").innerHTML = '<div class="empty-state">正在读取项目文件…</div>';
    else if (message) $("#documentList").innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    else if (!files.length) $("#documentList").innerHTML = '<div class="empty-state">当前项目还没有归档文件</div>';
    else $("#documentList").innerHTML = files.map(file=>{ const signed=file.type==="confirmation"&&file.documentStatus==="signed"; const canDelete=documentState.user?.role==="admin"||(file.uploadedBy===currentUser().name&&(file.type==="quotation"||(file.type==="confirmation"&&!signed))); return `<div class="document-row"><span class="document-type-badge ${signed?"signed":""}">${escapeHtml(file.typeLabel)}${file.type==="confirmation"?` · ${signed?"已签署":"待签署"}`:""}</span><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><small>${formatDocumentSize(file.size)}</small><small>${escapeHtml(file.uploadedBy)}<br>${new Date(file.uploadedAt).toLocaleDateString("zh-CN")}</small><span class="document-actions"><button data-document-download="${file.id}" data-document-name="${escapeHtml(file.name)}">下载</button>${canDelete?`<button class="danger" data-document-delete="${file.id}">删除</button>`:""}</span></div>`;}).join("");
    if (folder && ["po_email","signed_confirmation"].includes(folder.complianceScenario) && isDocumentAdmin()) $("#documentScenario").value = folder.complianceScenario;
    updateDocumentTypeOptions(); bindDocumentRows();
  }

  function formatDocumentSize(bytes) { return bytes < 1024*1024 ? `${Math.max(1,Math.round(bytes/1024))} KB` : `${(bytes/1024/1024).toFixed(1)} MB`; }

  function bindDocumentRows() {
    $$('[data-document-download]').forEach(button=>button.onclick=async()=>{ try { const response=await documentApi(`/api/integrated/files/${button.dataset.documentDownload}?projectId=${backendMeetingId}`,{download:true}); const url=URL.createObjectURL(await response.blob()); const link=document.createElement("a"); link.href=url; link.download=button.dataset.documentName; link.click(); setTimeout(()=>URL.revokeObjectURL(url),30000); } catch(error){ toast(error.message,"error"); } });
    $$('[data-document-delete]').forEach(button=>button.onclick=async()=>{ if(!confirm("确认删除这个项目文件？"))return; try{await documentApi(`/api/integrated/files/${button.dataset.documentDelete}?projectId=${backendMeetingId}`,{method:"DELETE"});toast("文件已删除");await loadDocuments();renderProjects();}catch(error){toast(error.message,"error");} });
  }

  async function uploadDocument(event) {
    event.preventDefault(); const form=event.currentTarget; const file=form.elements.file.files[0]; const selectedType=form.elements.type.value; $("#documentError").textContent=""; if(!file||!selectedType)return $("#documentError").textContent="请选择文件类型和文件";
    const type=selectedType.startsWith("confirmation_")?"confirmation":selectedType; const status=selectedType==="confirmation_signed"?"signed":selectedType==="confirmation_pending"?"pending":""; const scenario=isDocumentAdmin()?form.elements.scenario.value:"";
    try { const query=new URLSearchParams({type,filename:file.name}); if(status)query.set("status",status); if(scenario)query.set("scenario",scenario); await documentApi(`/api/integrated/projects/${backendMeetingId}/documents?${query}`,{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:file}); form.elements.file.value=""; $("#documentFileName").textContent="单个文件最大 50MB"; await loadDocuments(); renderProjects(); toast(activeArchiveReady()?"文件已归档，报名与行程功能现已开放":"文件已归档，请继续补齐报价和待签署会务确认单"); }
    catch(error){ $("#documentError").textContent=error.message; }
  }

  function renderRegistrationOwner() {
    const select = $("#registrationOwner");
    const sales = state.users.filter(user => user.role === "sales");
    const options = currentUser().role === "sales" ? [currentUser()] : sales.length ? sales : [currentUser()];
    select.innerHTML = options.map(user => `<option value="${user.id}">${escapeHtml(user.name)} · ${escapeHtml(user.label)}</option>`).join("");
    select.value = options.some(u => u.id === select.value) ? select.value : options[0]?.id;
  }

  function renderCounts() {
    const list = activeVisibleAttendees();
    const pending = list.filter(a => a.approval === "pending").length;
    const unread = state.notifications.filter(n => !n.read).length;
    $("#navAttendeeCount").textContent = list.length;
    $("#navApprovalCount").textContent = pending || "";
    $("#navNoticeCount").textContent = unread || "";
    $("#topNoticeCount").textContent = unread;
  }

  const normalizeQuotaRole = value => /主席|主持|讲者|讨论嘉宾|组长|嘉宾|chair|moderator|speaker|panelist/i.test(String(value||"").trim()) ? "嘉宾" : "听众";
  const normalizeQuotaRegion = value => String(value||"").trim()||"未填写大区";
  const quotaKey = (venue,region,role) => [normalizeVenueLabel(venue),normalizeQuotaRegion(region),normalizeQuotaRole(role)].join("|");
  const quotaNumber = value => Math.max(0,Math.round(Number(value)||0));
  function normalizedQuotaConfiguration() {
    const grouped=new Map();
    (state.settings.registrationQuotas||[]).forEach(item=>{const normalized={venue:normalizeVenueLabel(item.venue),region:normalizeQuotaRegion(item.region),role:normalizeQuotaRole(item.role),quota:quotaNumber(item.quota)};const key=quotaKey(normalized.venue,normalized.region,normalized.role);const previous=grouped.get(key);grouped.set(key,previous?{...previous,quota:previous.quota+normalized.quota}:normalized);});
    return [...grouped.values()];
  }
  function registrationQuotaRows(role=activeQuotaRole) {
    const configured=normalizedQuotaConfiguration();
    const actualMap=new Map(); activeVisibleAttendees().forEach(attendee=>{const key=quotaKey(attendee.venue,attendee.region,attendee.attendeeType);actualMap.set(key,(actualMap.get(key)||0)+1);});
    const rows=configured.filter(item=>item.role===role).map(item=>{const actual=actualMap.get(quotaKey(item.venue,item.region,item.role))||0;actualMap.delete(quotaKey(item.venue,item.region,item.role));return{...item,actual};});
    for(const[key,actual]of actualMap){const[venue,region,itemRole]=key.split("|");if(itemRole===role)rows.push({venue,region,role:itemRole,quota:0,actual});}
    return rows.map(item=>{const gap=item.actual-item.quota;const remaining=Math.max(item.quota-item.actual,0);const percent=item.quota?item.actual/item.quota*100:item.actual?100:0;return{...item,gap,remaining,percent};});
  }
  function quotaRoleOptions() {
    return ["听众","嘉宾"];
  }
  const quotaState = row => row.gap<0?["shortage","缺口"]:row.gap>0?["over","超额"]:row.quota?["complete","达标"]:["neutral","持平"];
  function renderRegistrationProgress() {
    const roles=quotaRoleOptions();if(!roles.includes(activeQuotaRole))activeQuotaRole=roles[0]||"听众";
    $("#quotaRoleFilter").innerHTML=roles.map(role=>`<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join("");$("#quotaRoleFilter").value=activeQuotaRole;
    $("#quotaRoleTabs").innerHTML=roles.map(role=>`<button type="button" class="${role===activeQuotaRole?"active":""}" data-quota-role="${escapeHtml(role)}">${escapeHtml(role)}</button>`).join("");
    $$('[data-quota-role]').forEach(button=>button.onclick=()=>{activeQuotaRole=button.dataset.quotaRole;renderRegistrationProgress();});
    $("#configureQuotas").classList.toggle("is-hidden",!canManage());
    const rows=registrationQuotaRows();const quotaConfigured=(state.settings.registrationQuotas||[]).some(item=>normalizeQuotaRole(item.role)===activeQuotaRole);const quota=rows.reduce((sum,row)=>sum+row.quota,0);const actual=rows.reduce((sum,row)=>sum+row.actual,0);const gap=actual-quota;const remaining=Math.max(quota-actual,0);const percent=quota?actual/quota*100:0;
    const summaryCards=quotaConfigured?[
      ["分配名额",quota,"当前类别目标","quota"],["实际报名",actual,"直接读取当前有效名单","actual"],[gap<0?"名额缺口":"名额差额",gap<0?remaining:`+${gap}`,gap<0?"仍需继续报名":"已达到或超过目标",gap<0?"shortage":"over"],["完成率",`${percent.toFixed(1)}%`,`${actual} / ${quota||0}`,"rate"],
    ]:[
      ["分配名额","未配置","点击右上角配置名额","quota"],["实际报名",actual,"直接读取当前有效名单","actual"],["涉及会场",new Set(rows.map(row=>row.venue)).size,"来自名单中的会场字段","over"],["统计类别",activeQuotaRole,"与名单类别保持一致","rate"],
    ];
    $("#quotaSummary").innerHTML=summaryCards.map(([label,value,note,type])=>`<div class="quota-summary-item ${type}"><small>${label}</small><strong>${escapeHtml(String(value))}</strong><span>${note}</span></div>`).join("");
    const byVenue=[...new Set(rows.map(row=>row.venue))].map(venue=>{const list=rows.filter(row=>row.venue===venue);const venueQuota=list.reduce((sum,row)=>sum+row.quota,0);const venueActual=list.reduce((sum,row)=>sum+row.actual,0);return{venue,quota:venueQuota,actual:venueActual,gap:venueActual-venueQuota,percent:venueQuota?venueActual/venueQuota*100:0};});
    $("#quotaVenueProgress").innerHTML=byVenue.length?byVenue.map(item=>`<div class="quota-venue-row"><div><strong>${escapeHtml(item.venue)}</strong><span>${quotaConfigured?`${item.actual} / ${item.quota} 人`:`当前名单 ${item.actual} 人`}</span></div><div class="quota-venue-numbers">${quotaConfigured?`<span>尚缺 <b class="${item.gap<0?"negative":"positive"}">${Math.max(-item.gap,0)}</b></span><strong>${item.percent.toFixed(1)}%</strong>`:`<span>分配名额待配置</span><strong>${item.actual}人</strong>`}</div><div class="quota-meter"><i class="${quotaConfigured&&item.percent>=100?"over":""}" style="width:${quotaConfigured?Math.min(item.percent,100):0}%"></i>${quotaConfigured?`<span style="left:${Math.min(item.percent,100)}%"></span>`:""}</div></div>`).join(""):`<div class="empty-state">当前名单中暂无${escapeHtml(activeQuotaRole)}数据</div>`;
    const alertHtml=(items,type)=>items.length?items.slice(0,3).map((row,index)=>`<div class="quota-alert-row"><b>${index+1}</b><span><strong>${escapeHtml(row.region)}</strong><small>${escapeHtml(row.venue)} · ${escapeHtml(row.role)}</small></span><em class="${type}">${row.gap>0?"+":""}${row.gap}</em></div>`).join(""):`<div class="quota-alert-empty">暂无${type==="shortage"?"名额缺口":"超额报名"}</div>`;
    $("#quotaShortageList").innerHTML=quotaConfigured?alertHtml(rows.filter(row=>row.gap<0).sort((a,b)=>a.gap-b.gap),"shortage"):`<div class="quota-alert-empty">配置分组名额后生成缺口预警</div>`;$("#quotaOverList").innerHTML=quotaConfigured?alertHtml(rows.filter(row=>row.gap>0).sort((a,b)=>b.gap-a.gap),"over"):`<div class="quota-alert-empty">配置分组名额后生成超额提醒</div>`;
    if(!rows.length){$("#quotaProgressBody").innerHTML=`<tr><td colspan="9"><div class="empty-state">点击“配置名额”建立报名目标后即可统计</div></td></tr>`;return;}
    const detailRow=row=>{if(!quotaConfigured)return`<tr><td><strong>${escapeHtml(row.venue)}</strong></td><td>${escapeHtml(row.region)}</td><td>${escapeHtml(row.role)}</td><td>—</td><td>${row.actual}</td><td>—</td><td>—</td><td>—</td><td><span class="quota-status neutral">未配置名额</span></td></tr>`;const[stateClass,label]=quotaState(row);return`<tr><td><strong>${escapeHtml(row.venue)}</strong></td><td>${escapeHtml(row.region)}</td><td>${escapeHtml(row.role)}</td><td>${row.quota}</td><td>${row.actual}</td><td><b class="quota-gap ${stateClass}">${row.gap>0?"+":""}${row.gap}</b></td><td>${row.remaining}</td><td><div class="quota-rate"><span>${row.percent.toFixed(1)}%</span><i><b class="${stateClass}" style="width:${Math.min(row.percent,100)}%"></b></i></div></td><td><span class="quota-status ${stateClass}">${label}</span></td></tr>`;};
    const summaryRow=(label,list,grand=false)=>{const subtotalQuota=list.reduce((sum,row)=>sum+row.quota,0);const subtotalActual=list.reduce((sum,row)=>sum+row.actual,0);if(!quotaConfigured)return`<tr class="${grand?"quota-grand-total":"quota-subtotal"}"><td colspan="3"><strong>${escapeHtml(label)}</strong></td><td>—</td><td>${subtotalActual}</td><td>—</td><td>—</td><td>—</td><td><span class="quota-status neutral">名单直连</span></td></tr>`;const subtotalGap=subtotalActual-subtotalQuota;const subtotalRemaining=Math.max(subtotalQuota-subtotalActual,0);const subtotalPercent=subtotalQuota?subtotalActual/subtotalQuota*100:0;const[stateClass,statusLabel]=quotaState({gap:subtotalGap,quota:subtotalQuota});return`<tr class="${grand?"quota-grand-total":"quota-subtotal"}"><td colspan="3"><strong>${escapeHtml(label)}</strong></td><td>${subtotalQuota}</td><td>${subtotalActual}</td><td><b class="quota-gap ${stateClass}">${subtotalGap>0?"+":""}${subtotalGap}</b></td><td>${subtotalRemaining}</td><td><strong>${subtotalPercent.toFixed(1)}%</strong></td><td><span class="quota-status ${stateClass}">${statusLabel}</span></td></tr>`;};
    const ordered=[...rows].sort((a,b)=>a.venue.localeCompare(b.venue,"zh-CN")||a.region.localeCompare(b.region,"zh-CN"));const venues=[...new Set(ordered.map(row=>row.venue))];
    $("#quotaProgressBody").innerHTML=venues.map(venue=>{const list=ordered.filter(row=>row.venue===venue);return list.map(detailRow).join("")+summaryRow(`${venue}${activeQuotaRole}小计`,list);}).join("")+summaryRow(`${activeQuotaRole}合计`,ordered,true);
  }

  function quotaConfigOptions(key,value) { const configured=state.settings.registrationQuotas||[];const source=key==="venue"?[...(state.settings.venues||[]).map(normalizeVenueLabel),...configured.map(item=>normalizeVenueLabel(item.venue)),...activeVisibleAttendees().map(item=>normalizeVenueLabel(item.venue))]:key==="role"?["听众","嘉宾"]:[...configured.map(item=>normalizeQuotaRegion(item.region)),...activeVisibleAttendees().map(item=>normalizeQuotaRegion(item.region))];const options=[...new Set(source.filter(Boolean))];if(value&&!options.includes(value))options.unshift(value);return options.map(option=>`<option value="${escapeHtml(option)}" ${option===value?"selected":""}>${escapeHtml(option)}</option>`).join(""); }
  const parseQuotaRegions = value => String(value||"").split(/[、,，\n]+/).map(item=>item.trim()).filter(Boolean);
  function quotaRegionChoices(extra=[]) { const configured=state.settings.registrationQuotas||[];return[...new Set([...extra,...(state.settings.quotaRegions||[]),...configured.map(item=>normalizeQuotaRegion(item.region)),...activeVisibleAttendees().map(item=>normalizeQuotaRegion(item.region))].map(value=>String(value||"").trim()).filter(Boolean))]; }
  function renderQuotaRegionOptions(extra=[]) { $("#quotaRegionOptions").innerHTML=quotaRegionChoices(extra).map(region=>`<option value="${escapeHtml(region)}"></option>`).join(""); }
  function appendQuotaConfigRow(item={venue:normalizeVenueLabel(state.settings.venues?.[0])||normalizeVenueLabel(activeVisibleAttendees()[0]?.venue)||"",region:state.settings.quotaRegions?.[0]||normalizeQuotaRegion(activeVisibleAttendees()[0]?.region),role:activeQuotaRole,quota:0}) { const row=document.createElement("div");row.className="quota-config-row";row.innerHTML=`<select name="quotaVenue" aria-label="会场">${quotaConfigOptions("venue",normalizeVenueLabel(item.venue))}</select><input name="quotaRegion" list="quotaRegionOptions" value="${escapeHtml(normalizeQuotaRegion(item.region))}" placeholder="选择或输入大区" aria-label="大区"/><select name="quotaRole" aria-label="角色">${quotaConfigOptions("role",normalizeQuotaRole(item.role))}</select><input name="quotaValue" type="number" min="0" step="1" value="${quotaNumber(item.quota)}" aria-label="分配名额"/><button type="button" class="quota-remove-row">删除</button>`;row.querySelector(".quota-remove-row").onclick=()=>row.remove();$("#quotaConfigRows").append(row); }
  function openQuotaConfiguration() { if(!canManage())return deny();$("#quotaRegionPresets").value=(state.settings.quotaRegions||[]).join("、");renderQuotaRegionOptions();$("#quotaConfigRows").innerHTML="";normalizedQuotaConfiguration().forEach(appendQuotaConfigRow);if(!$("#quotaConfigRows").children.length)appendQuotaConfigRow();$("#quotaFormError").textContent="";$("#quotaDialog").showModal(); }
  async function saveQuotaConfiguration(event) { event.preventDefault();if(!canManage())return deny();const button=event.currentTarget.querySelector('button[type="submit"]');const rows=$$(".quota-config-row",event.currentTarget).map(row=>({venue:normalizeVenueLabel(row.querySelector('[name="quotaVenue"]').value),region:normalizeQuotaRegion(row.querySelector('[name="quotaRegion"]').value),role:normalizeQuotaRole(row.querySelector('[name="quotaRole"]').value),quota:quotaNumber(row.querySelector('[name="quotaValue"]').value)}));const seen=new Set();if(rows.some(row=>!row.venue||!row.region||!row.role))return $("#quotaFormError").textContent="请完整填写每一行名额配置";if(rows.some(row=>{const key=quotaKey(row.venue,row.region,row.role);if(seen.has(key))return true;seen.add(key);return false;}))return $("#quotaFormError").textContent="同一会场、大区和角色不能重复配置";const presets=parseQuotaRegions($("#quotaRegionPresets").value);const quotaRegions=[...new Set([...presets,...rows.map(row=>row.region)])];button.disabled=true;try{if(backend){const fieldConfig={...state.settings.fieldConfig,registrationQuotas:rows,quotaRegions};const{error}=await backend.from("meetings").update({field_config:fieldConfig}).eq("id",backendMeetingId);if(error)throw error;}state.settings.registrationQuotas=rows;state.settings.quotaRegions=quotaRegions;addNotification("change",`${currentUser().name}更新了报名名额配置，共${rows.length}项、大区${quotaRegions.length}个`);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$("#quotaDialog").close();renderAll();toast("名额与大区配置已保存，报名进度已重新统计");}catch(error){$("#quotaFormError").textContent=error.message||"名额保存失败";}finally{button.disabled=false;} }

  function renderDashboard() {
    const list = activeVisibleAttendees(); const pending = list.filter(a => a.approval === "pending").length;
    const assigned = list.filter(a => a.transport?.pickup?.driver && a.transport.pickup.driver !== "待分配").length;
    const metrics = [
      ["已报名人数", list.length, `名额 ${state.settings.capacity} 人`, "♟", "#f9dfe2"],
      ["待审批行程", pending, pending ? "需要及时处理" : "全部处理完成", "△", "#f8e9cd"],
      ["住宿需求", list.filter(a => a.accommodation === "Y").length, "已选择住宿", "⌂", "#ece3eb"],
      ["已安排接送", assigned, `共 ${list.length} 位参会者`, "↗", "#dcebe7"],
    ];
    $("#metricGrid").innerHTML = metrics.map(([label,value,note,icon,tint]) => `<article class="metric-card" style="--metric-tint:${tint}"><p>${label}</p><strong>${value}</strong><small>${note}</small><span>${icon}</span></article>`).join("");
    renderRegistrationProgress();
    const risks = list.filter(a => a.approval === "pending").slice(0,3);
    $("#attentionList").innerHTML = risks.length ? risks.map(a => `<div class="attention-item"><span class="attention-icon">△</span><div><strong>${escapeHtml(a.name)} · ${escapeHtml(a.risks[0] || "异常行程")}</strong><small>${escapeHtml(a.outFrom)} → ${escapeHtml(a.outTo)} / ${escapeHtml(a.returnFrom)} → ${escapeHtml(a.returnTo)}</small></div><button data-open-attendee="${a.id}">处理 →</button></div>`).join("") : `<div class="empty-state">暂无待处理事项</div>`;
    $("#recentTimeline").innerHTML = state.notifications.slice(0,4).map(n => `<div class="timeline-item"><p>${escapeHtml(n.text)}</p><small>${relativeTime(n.time)}</small></div>`).join("");
    bindDynamicButtons();
  }

  function getFilteredAttendees() {
    const query = $("#attendeeSearch").value.trim().toLowerCase(); const risk = $("#riskFilter").value; const venue = $("#venueFilter").value;
    const templateColumns=(state.settings.registrationTemplate?.columns?.length?state.settings.registrationTemplate:standardTemplate()).columns.filter(column=>column.key!=="sequence");
    return visibleAttendees().filter(a => {
      const haystack = [a.name,a.city,a.hospital,a.department,a.outNo,a.returnNo].join(" ").toLowerCase();
      const hasMissing=templateColumns.some(column=>{const value=column.custom?a.customFields?.[column.key]:a[column.key];return value===null||value===undefined||String(value).trim()==="";});
      const matchesArchive=cancelledRosterView?a.businessStatus==="cancelled":a.businessStatus!=="cancelled";
      return matchesArchive && (!query || haystack.includes(query)) && (risk === "all" || a.approval === risk) && (venue === "all" || normalizeVenueLabel(a.venue) === venue) && (!incompleteRosterOnly||hasMissing);
    });
  }
  function syncRosterVenueFilter(){const select=$("#venueFilter");const previous=normalizeVenueLabel(select.value)||"all";const scoped=visibleAttendees().filter(a=>cancelledRosterView?a.businessStatus==="cancelled":a.businessStatus!=="cancelled");const actual=[...new Set(scoped.map(a=>normalizeVenueLabel(a.venue)).filter(Boolean))];const fallback=(state.settings.venues||[]).map(normalizeVenueLabel).filter(Boolean);const values=[...new Set(actual.length?actual:fallback)].sort((a,b)=>a.localeCompare(b,"zh-CN"));select.innerHTML=`<option value="all">全部会场</option>${values.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;select.value=values.includes(previous)?previous:"all";}
  function renderAttendeeTable() {
    syncRosterVenueFilter();
    const list = getFilteredAttendees();
    const templateColumns=(state.settings.registrationTemplate?.columns?.length?state.settings.registrationTemplate:standardTemplate()).columns;
    $("#rosterScope").textContent = cancelledRosterView ? "已删除或已取消报名的人员归档；完整保留报名模板全部字段。" : currentUser().role === "sales" ? `仅显示 ${currentUser().name} 负责的有效参会者。` : "显示本会议当前有效参会者，不包含已删除或已取消报名。";
    $("#importRoster").classList.toggle("is-hidden", currentUser().role !== "ops");
    $("#auditTravel").classList.toggle("is-hidden", !canManage());
    $("#transferRegistrant").classList.toggle("is-hidden",!canManage()&&!isSystemAdmin());
    $("#toggleIncompleteFilter").classList.toggle("active",incompleteRosterOnly);$("#toggleIncompleteFilter").textContent=incompleteRosterOnly?"✓ 仅看未填写":"筛选未填写";
    const cancelledCount=visibleAttendees().filter(a=>a.businessStatus==="cancelled").length;$("#cancelledRosterCount").textContent=cancelledCount;$("#toggleCancelledRoster").classList.toggle("active",cancelledRosterView);$("#toggleCancelledRoster").innerHTML=cancelledRosterView?`← 返回参会名单 <span id="cancelledRosterCount">${cancelledCount}</span>`:`查看已删除报名 <span id="cancelledRosterCount">${cancelledCount}</span>`;
    $("#deleteSelectedAttendees").classList.toggle("is-hidden",cancelledRosterView);
    const progressSelect=(a,field,options)=>`<select class="progress-select ${["electronic","paper","ticketed"].includes(a[field])?"done":""}" data-progress-field="${field}" data-attendee-id="${a.id}" ${isLocked(a)||!canEditAttendeeData()||a.businessStatus==="cancelled"?"disabled":""}>${options.map(([value,label])=>`<option value="${value}" ${a[field]===value?"selected":""}>${label}</option>`).join("")}</select>`;
    const privacyControl=a=>`<div class="privacy-progress-control">${progressSelect(a,"privacyLetterStatus",[["pending","未完成"],["electronic","已完成（隐私沟通函电子版）"],["paper","已完成（隐私沟通函纸质版）"]])}${a.privacyLetterStatus==="paper"?`<div class="privacy-file-actions">${a.privacyLetterFilePath?`<button type="button" data-download-privacy-letter="${a.id}" title="${escapeHtml(a.privacyLetterFileName)}">查看附件</button>`:`<span>缺少纸质版附件</span>`}<button type="button" data-upload-privacy-letter="${a.id}">${a.privacyLetterFilePath?"替换":"上传"}</button></div>`:""}</div>`;
    const segmentBadge=(a,segment,label)=>{ const status=segmentApproval(a,segment); const text=status==="approved"?"已审批":status==="pending"?"待审批":status==="rejected"?"已退回":"无需审批"; return `<span class="segment-status ${status}">${label}·${text}</span>`; };
    const templateHeader=column=>escapeHtml(column.header||column.key||"未命名字段").replaceAll("\n","<br>");
    const templateValue=(attendee,column,index)=>{if(column.key==="sequence")return String(index+1);if(column.key==="contactName")return attendee.contactName||"";if(column.key==="contactMobile")return attendee.contactMobile||"";if(column.key==="venue")return normalizeVenueLabel(attendee.venue);return column.custom?attendee.customFields?.[column.key]??"":attendee[column.key]??"";};
    const templateCell=(attendee,column,index)=>{const raw=templateValue(attendee,column,index);const empty=raw===null||raw===undefined||String(raw).trim()==="";const display=empty?"未填写":String(raw);return `<td class="template-data-cell" data-template-key="${escapeHtml(column.key||"")}" title="${escapeHtml(display)}"><span class="${empty?"template-empty":""}">${escapeHtml(display)}</span></td>`;};
    const selectable=list.filter(a=>a.businessStatus!=="cancelled"&&!isLocked(a)&&canEditAttendeeData()&&(currentUser().role!=="sales"||a.ownerId===currentUser().id));
    const allSelected=selectable.length>0&&selectable.every(a=>selectedAttendeeIds.has(a.id));
    $("#attendeeTableHead").innerHTML=`<th class="roster-check-cell"><input id="selectVisibleAttendees" type="checkbox" aria-label="全选当前名单" ${allSelected?"checked":""} ${selectable.length?"":"disabled"}></th>${templateColumns.map(column=>`<th data-template-key="${escapeHtml(column.key||"")}">${templateHeader(column)}</th>`).join("")}<th>报名状态</th><th>隐私沟通函</th><th>出票状态</th><th>负责人</th><th>行程审批</th><th>操作</th>`;
    $("#attendeeTableBody").innerHTML = list.map((a,index) => {const selectableRow=a.businessStatus!=="cancelled"&&!isLocked(a)&&canEditAttendeeData()&&(currentUser().role!=="sales"||a.ownerId===currentUser().id);return `<tr class="${a.businessStatus==="cancelled"?"cancelled-row":""}"><td class="roster-check-cell"><input type="checkbox" data-select-attendee="${a.id}" aria-label="选择${escapeHtml(a.name)}" ${selectedAttendeeIds.has(a.id)?"checked":""} ${selectableRow?"":"disabled"}></td>${templateColumns.map(column=>templateCell(a,column,index)).join("")}<td><span class="status ${a.businessStatus==="cancelled"?"status-pending":"status-normal"}">${a.businessStatus==="cancelled"?"已取消报名":"有效报名"}</span></td><td>${privacyControl(a)}</td><td>${progressSelect(a,"ticketStatus",[["pending","待出票"],["processing","出票中"],["ticketed","已出票"],["changed","改签"],["refunded","已退票"]])}</td><td>${escapeHtml(userName(a.ownerId))}</td><td><div class="approval-status-stack">${segmentBadge(a,"outbound","去程")}${segmentBadge(a,"return","返程")}</div></td><td><button class="row-action" data-open-attendee="${a.id}" aria-label="查看详情">•••</button></td></tr>`;}).join("");
    $("#selectVisibleAttendees").onchange=event=>{selectable.forEach(a=>event.target.checked?selectedAttendeeIds.add(a.id):selectedAttendeeIds.delete(a.id));renderAttendeeTable();};
    $$('[data-select-attendee]').forEach(input=>input.onchange=()=>{input.checked?selectedAttendeeIds.add(input.dataset.selectAttendee):selectedAttendeeIds.delete(input.dataset.selectAttendee);updateSelectedAttendeeControls();});
    $$('[data-progress-field]').forEach(select=>select.onchange=()=>updateProgressField(select));
    $$('[data-upload-privacy-letter]').forEach(button=>button.onclick=()=>requestPrivacyLetterUpload(state.attendees.find(item=>item.id===button.dataset.uploadPrivacyLetter)));
    $$('[data-download-privacy-letter]').forEach(button=>button.onclick=()=>downloadPrivacyLetter(state.attendees.find(item=>item.id===button.dataset.downloadPrivacyLetter)));
    $("#attendeeEmpty").textContent=cancelledRosterView?"暂无已删除或已取消报名人员":"没有符合条件的当前参会人员";$("#attendeeEmpty").classList.toggle("is-hidden", !!list.length); bindDynamicButtons();
    updateSelectedAttendeeControls();
  }

  function updateSelectedAttendeeControls(){for(const id of [...selectedAttendeeIds])if(!state.attendees.some(a=>a.id===id&&a.businessStatus!=="cancelled"))selectedAttendeeIds.delete(id);const count=selectedAttendeeIds.size;$("#selectedAttendeeCount").textContent=count;$("#deleteSelectedAttendees").disabled=!count||!canEditAttendeeData();}

  async function deleteSelectedAttendees(){const attendees=state.attendees.filter(a=>selectedAttendeeIds.has(a.id)&&a.businessStatus!=="cancelled"&&!isLocked(a)&&(currentUser().role!=="sales"||a.ownerId===currentUser().id));if(!attendees.length)return toast("没有可删除的已选名单","error");if(!confirm(`确认删除所选 ${attendees.length} 条报名？记录将标记为“已取消报名”并保留审计历史。`))return;const ids=attendees.map(a=>a.id);try{if(backend){const{error}=await backend.from("attendees").update({business_status:"cancelled",cancelled_at:new Date().toISOString()}).in("id",ids).eq("meeting_id",backendMeetingId);if(error)throw error;}attendees.forEach(a=>a.businessStatus="cancelled");addNotification("change",`${currentUser().name}删除所选名单：${attendees.map(a=>a.name).join("、")}（已转为取消报名）`);selectedAttendeeIds.clear();saveState();renderAll();toast(`已删除 ${attendees.length} 条名单，审计记录已保留`);}catch(error){toast(error.message||"删除名单失败","error");}}

  function updateProgressField(select) {
    const a=state.attendees.find(item=>item.id===select.dataset.attendeeId); if(!a||isLocked(a)) return renderAttendeeTable();
    if(!canEditAttendeeData()||(currentUser().role==="sales"&&a.ownerId!==currentUser().id)) return deny();
    const field=select.dataset.progressField; const previous=a[field]||"pending"; const next=select.value; if(previous===next)return;
    if(field==="privacyLetterStatus"&&next==="paper"&&!a.privacyLetterFilePath){select.value=previous;requestPrivacyLetterUpload(a);return;}
    if(field==="ticketStatus"&&["processing","ticketed","changed"].includes(next)) { const blockers=ticketApprovalBlockers(a); if(blockers.length){ select.value=previous; const labels=blockers.map(segment=>segment==="outbound"?"去程":"返程").join("、"); return toast(`${a.name}的${labels}行程尚未审批通过，不能进行出票`,"error"); } }
    const labels={pending:"未完成",electronic:"已完成（隐私沟通函电子版）",paper:"已完成（隐私沟通函纸质版）",processing:"出票中",ticketed:"已出票",changed:"改签",refunded:"已退票"};
    a[field]=next; addNotification("change",`${currentUser().name}变更了${a.name}的${FIELD_LABELS[field]}：${labels[previous]||previous} → ${labels[next]||next}`); saveState(); renderAll(); toast(`${a.name}的${FIELD_LABELS[field]}已更新`);
  }

  function requestPrivacyLetterUpload(attendee) {
    if(!attendee||isLocked(attendee)||!canEditAttendeeData())return deny();
    const input=document.createElement("input");input.type="file";input.accept="application/pdf,image/jpeg,image/png,image/webp";input.hidden=true;document.body.append(input);
    input.onchange=async()=>{const file=input.files?.[0];input.remove();if(!file)return;if(file.size>15*1024*1024)return toast("隐私沟通函附件不能超过 15MB","error");if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type))return toast("仅支持 PDF、JPG、PNG 或 WebP 文件","error");await uploadPrivacyLetter(attendee,file);};
    input.addEventListener("cancel",()=>input.remove(),{once:true});input.click();
  }

  async function uploadPrivacyLetter(attendee,file) {
    const previousPath=attendee.privacyLetterFilePath||"";const safeName=file.name.replace(/[^\p{L}\p{N}._-]+/gu,"-").slice(-120)||"privacy-letter";const path=`${backendMeetingId||state.activeProjectId}/${attendee.id}/${crypto.randomUUID()}-${safeName}`;
    try{
      if(backend){const upload=await backend.storage.from("privacy-letter-files").upload(path,file,{contentType:file.type,upsert:false});if(upload.error)throw upload.error;const values={privacy_letter_status:"paper",privacy_letter_file_path:path,privacy_letter_file_name:file.name,privacy_letter_file_size:file.size,privacy_letter_uploaded_at:new Date().toISOString(),privacy_letter_uploaded_by:state.currentUserId};const update=await backend.from("attendees").update(values).eq("id",attendee.id).eq("meeting_id",backendMeetingId);if(update.error){await backend.storage.from("privacy-letter-files").remove([path]);throw update.error;}if(previousPath&&previousPath!==path)await backend.storage.from("privacy-letter-files").remove([previousPath]);}
      attendee.privacyLetterStatus="paper";attendee.privacyLetterFilePath=path;attendee.privacyLetterFileName=file.name;attendee.privacyLetterFileSize=file.size;attendee.privacyLetterUploadedAt=new Date().toISOString();attendee.privacyLetterUploadedBy=state.currentUserId;addNotification("change",`${currentUser().name}上传了${attendee.name}的纸质版隐私沟通函：${file.name}`);saveState();renderAll();toast(`${attendee.name}的纸质版隐私沟通函已上传`);
    }catch(error){toast(error.message||"隐私沟通函上传失败","error");}
  }

  async function downloadPrivacyLetter(attendee) {
    if(!backend||!attendee?.privacyLetterFilePath)return toast("未找到纸质版附件","error");
    try{const{data,error}=await backend.storage.from("privacy-letter-files").createSignedUrl(attendee.privacyLetterFilePath,60,{download:attendee.privacyLetterFileName||"隐私沟通函"});if(error)throw error;window.open(data.signedUrl,"_blank","noopener");}catch(error){toast(error.message||"附件下载失败","error");}
  }

  function renderApprovals() {
    const list = activeVisibleAttendees().filter(a => ["outbound","return"].some(segment=>["pending","rejected"].includes(segmentApproval(a,segment))));
    const segmentRow=(a,segment)=>{ const outbound=segment==="outbound"; const status=segmentApproval(a,segment); const risks=evaluateSegmentRisks(a)[segment]; if(status==="normal")return""; return `<div class="segment-approval-row"><div><span class="segment-status ${status}">${outbound?"去程":"返程"} · ${status==="approved"?"已审批":status==="rejected"?"已退回":"待审批"}</span><strong>${escapeHtml(outbound?`${a.outFrom} → ${a.outTo} · ${a.outNo}`:`${a.returnFrom} → ${a.returnTo} · ${a.returnNo}`)}</strong><small>${risks.map(escapeHtml).join("；")}</small></div><div class="segment-actions"><button class="button button-secondary" data-reject="${a.id}" data-segment="${segment}" ${canEditAttendeeData()?"":"disabled"}>退回</button><button class="button button-primary" data-approve="${a.id}" data-segment="${segment}" ${canEditAttendeeData()?"":"disabled"}>审批通过</button></div></div>`; };
    $("#approvalBoard").innerHTML = list.length ? list.map(a => `<article class="panel approval-card segment-approval-card"><span class="status status-pending">分段审批</span><h3>${escapeHtml(a.name)}</h3><div class="approval-meta">${escapeHtml(a.hospital)} · 负责人 ${escapeHtml(userName(a.ownerId))}</div><div class="segment-approval-list">${segmentRow(a,"outbound")}${segmentRow(a,"return")}</div></article>`).join("") : `<article class="panel empty-state" style="grid-column:1/-1">没有待审批的异常行程</article>`;
    bindDynamicButtons();
  }

  function renderTransport() {
    const query = $("#transportSearch").value.trim().toLowerCase();
    const list = activeVisibleAttendees().filter(a => !query || [a.name,a.outNo,a.returnNo,a.transport?.pickup?.batchName,a.transport?.dropoff?.batchName].join(" ").toLowerCase().includes(query));
    renderTransportBatches(list);
    $("#newPickupBatch").classList.toggle("is-hidden",!canManage()); $("#newDropoffBatch").classList.toggle("is-hidden",!canManage()); $("#autoArrangeTransport").classList.toggle("is-hidden",!canManage());
    const cards = [];
    list.forEach(a => {
      ["pickup","dropoff"].forEach(type => {
        if (activeTransportFilter !== "all" && activeTransportFilter !== type) return;
        const item = a.transport?.[type] || {};
        const staff = isStaffTransport(item);
        const assigned = staff || (item.driver && item.driver !== "待分配");
        const contact = staff ? `${item.staffName || "会务工作人员"} · ${item.phone || "—"}` : `${item.driver || "待分配"} · ${item.phone || "—"}`;
        const vehicle = staff ? "无需录入司机 / 车辆" : (item.vehicle || "待分配");
        cards.push(`<article class="transport-card"><div class="transport-head"><div><h3>${escapeHtml(a.name)} · ${type === "pickup" ? "接机" : "送机"}</h3><p>${escapeHtml(type === "pickup" ? `${a.outNo} · ${a.outArrival} 到达` : `${a.returnNo} · ${a.returnDeparture} 出发`)}</p>${item.batchName?`<span class="transport-batch-tag">⌘ ${escapeHtml(item.batchName)}</span>`:""}</div><span class="status ${assigned ? "status-normal" : "status-pending"}">${assigned ? (staff ? "工作人员接待" : "独立司机") : "待分配"}</span></div><div class="transport-details"><div><small>接送方式</small><strong>${escapeHtml(contact)}</strong></div><div><small>车辆</small><strong>${escapeHtml(vehicle)}</strong></div><div><small>时间</small><strong>${escapeHtml(item.time || "待设置")}</strong></div><div><small>集合点</small><strong>${escapeHtml(item.point || "待设置")}</strong></div></div>${item.terminal?`<div class="transport-rule">目的地：${escapeHtml(item.terminal)}${item.placard?` · 接机牌：${escapeHtml(item.placard)}`:""}</div>`:type === "dropoff" ? `<div class="transport-rule">${isFlightReturn(a) ? `航班起飞前 ${state.settings.flightLeadMinutes} 分钟` : `高铁出发前 ${state.settings.trainLeadMinutes} 分钟`} · 建议 ${escapeHtml(recommendedDropoffTime(a) || "待补全返程时间")}</div>` : ""}${canManage() ? `<button class="transport-edit" data-edit-transport="${a.id}" data-type="${type}">编辑安排 →</button>` : ""}</article>`);
      });
    });
    $("#transportGrid").innerHTML = cards.join("") || `<div class="empty-state">暂无接送机记录</div>`; bindDynamicButtons();
  }

  const comparableStation = value => String(value||"").replace(/(?:火车)?站$/u,"").replace(/\s+/g,"").trim();
  const verificationProviderLabel = check => check?.source?.label || ({aerodatabox:"AeroDataBox（API.Market）",juhe_flight_dynamic:"聚合数据·全球航班动态",aliyun_train:"阿里云市场·聚合数据",train:"高铁计划接口",flight:"航班计划接口"}[check?.provider] || check?.provider || "计划时刻接口");
  const verifiedArrivalTime = match => match?.arrival ? `${match.arrival}${Number(match.arrivalDayOffset)>0?`+${match.arrivalDayOffset}`:""}` : "—";
  function verificationExport(check) {
    if(!check)return"未核验"; const match=check.match; const schedule=match?`${match.departure||"—"}-${verifiedArrivalTime(match)}`:"未查询到计划"; const warnings=check.warnings?.length?`；${check.warnings.join("；")}`:"";
    return `${schedule}｜${verificationProviderLabel(check)}｜${check.checkedAt?new Date(check.checkedAt).toLocaleString("zh-CN",{hour12:false}):"时间未知"}${warnings}`;
  }
  function verificationDetails(attendee) {
    const checks=attendee.customFields?._travelVerification||{}; if(!checks.outbound&&!checks.return)return"";
    const card=(segment,label)=>{const check=checks[segment];if(!check)return`<div><small>${label}计划核验</small><strong>尚未核验</strong></div>`;const match=check.match;const source=verificationProviderLabel(check);const checked=check.checkedAt?new Date(check.checkedAt).toLocaleString("zh-CN",{hour12:false}):"时间未知";const reference=check.source?.referenceUrl?` · <a href="${escapeHtml(check.source.referenceUrl)}" target="_blank" rel="noopener">查看公开参考</a>`:"";return`<div><small>${label}计划核验</small><strong>${match?`${escapeHtml(match.departure||"—")} → ${escapeHtml(verifiedArrivalTime(match))}`:"未查询到计划时刻"}</strong><span>${escapeHtml(source)} · ${escapeHtml(checked)}${reference}</span></div>`;};
    return `<div class="detail-grid verification-grid">${card("outbound","去程")}${card("return","返程")}</div>`;
  }
  function travelVerificationWarnings(attendee, segment, result) {
    const flight=result?.mode==="flight"; const service=flight?"航班":"车次";
    if(!result?.found||!result.match)return result?.warnings||[`未查询到该${service}的计划时刻`];
    const outbound=segment==="outbound"; const match=result.match; const warnings=[...(result.warnings||[])];
    const current={from:attendee[outbound?"outFrom":"returnFrom"],to:attendee[outbound?"outTo":"returnTo"],departure:attendee[outbound?"outDeparture":"returnDeparture"],arrival:attendee[outbound?"outArrival":"returnArrival"]};
    if(match.from&&comparableStation(current.from)!==comparableStation(match.from))warnings.push(`${outbound?"去程":"返程"}${flight?"出发机场/航站楼":"出发站"}与计划不一致：当前“${current.from}”，计划“${match.from}”`);
    if(match.to&&comparableStation(current.to)!==comparableStation(match.to))warnings.push(`${outbound?"去程":"返程"}${flight?"抵达机场/航站楼":"抵达站"}与计划不一致：当前“${current.to}”，计划“${match.to}”`);
    if(match.departure&&current.departure&&match.departure!==current.departure)warnings.push(`${outbound?"去程":"返程"}${flight?"计划起飞":"发车"}时间不一致：当前${current.departure}，计划${match.departure}`);
    if(match.arrival&&current.arrival&&match.arrival!==current.arrival)warnings.push(`${outbound?"去程":"返程"}${flight?"计划落地":"到站"}时间不一致：当前${current.arrival}，计划${match.arrival}`);
    return [...new Set(warnings)];
  }
  async function auditRosterTravel() {
    if(!canManage())return deny();
    const button=$("#auditTravel"); const originalText=button.textContent; button.disabled=true; button.textContent="⌛ 正在核验计划时刻";
    let normalized=0; let issues=0; let apiChecked=0; let cacheHits=0;
    state.attendees.forEach(attendee=>{
      ["outFrom","outTo","returnFrom","returnTo"].forEach(key=>{const next=normalizeTerminal(attendee[key]);if(next&&next!==attendee[key]){attendee[key]=next;normalized++;}});
      refreshTravelApprovals(attendee);
    });
    try {
      if(backend&&backendMeetingId){
        const journeys=[];
        state.attendees.forEach(attendee=>[["outbound","outDate","outNo","outFrom","outTo","outDeparture","outArrival"],["return","returnDate","returnNo","returnFrom","returnTo","returnDeparture","returnArrival"]].forEach(([segment,date,no,from,to,departure,arrival])=>{if(attendee[no]&&attendee[date]&&attendee[from]&&attendee[to])journeys.push({attendeeId:attendee.id,segment,mode:isTrainNumber(attendee[no])?"train":"flight",date:attendee[date],number:attendee[no],from:attendee[from],to:attendee[to],departure:attendee[departure],arrival:attendee[arrival]});}));
        if(journeys.length){
          const payload=await documentApi(`/api/integrated/projects/${backendMeetingId}/travel/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({journeys})});
          apiChecked=payload.results?.length||0; cacheHits=payload.usage?.cacheHits||0;
          (payload.results||[]).forEach(result=>{if((result.warnings||[]).some(warning=>/尚未配置/.test(warning)))return;const attendee=state.attendees.find(item=>item.id===result.attendeeId);if(!attendee)return;attendee.customFields={...(attendee.customFields||{})};const checks={...(attendee.customFields._travelVerification||{})};checks[result.segment]={provider:result.provider||result.mode,source:result.source||null,checkedAt:result.fetchedAt||result.source?.checkedAt||new Date().toISOString(),match:result.match||null,warnings:travelVerificationWarnings(attendee,result.segment,result)};attendee.customFields._travelVerification=checks;});
        }
      }
    } catch(error) {
      if(!/尚未配置/.test(error.message))toast(`计划时刻核验失败，已保留本地检查：${error.message}`,"error");
    } finally {
      state.attendees.forEach(attendee=>{refreshTravelApprovals(attendee);issues+=attendee.risks.length;});
      addNotification("change",`${currentUser().name}核验了${state.attendees.length}人的行程填写：${issues}项待核查${apiChecked?`，核对${apiChecked}段高铁/航班计划时刻（缓存${cacheHits}段）`:""}${normalized?`，标准化${normalized}处站点名称`:""}`);
      saveState(); renderAll(); location.hash="approvals"; button.disabled=false; button.textContent=originalText;
      toast(issues?`发现 ${issues} 项待核查信息，已进入行程审批`:`${state.attendees.length} 人的行程填写完整`,issues?"error":"success");
    }
  }

  function timeBucket(value,minutes) {
    const match=String(value||"").match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/); if(!match)return"";
    const total=Number(match[2])*60+Number(match[3]); const rounded=Math.floor(total/minutes)*minutes;
    return `${match[1]} ${String(Math.floor(rounded/60)).padStart(2,"0")}:${String(rounded%60).padStart(2,"0")}`;
  }

  function autoArrangeTransport() {
    if(!canManage()||state.locks.master)return toast("当前名单已锁定，不能自动排列接送表","error");
    const minutes=Math.min(180,Math.max(10,Number(state.settings.transportGroupMinutes)||30)); const groups=new Map(); let skipped=0;
    const add=(attendee,direction,terminal,serviceTime,number)=>{
      if(!terminal||!serviceTime||!isPreciseTerminal(terminal,number)){skipped++;return;}
      const existing=attendee.transport?.[direction]||{}; if(transportIsAssigned(existing)){return;}
      const bucket=timeBucket(serviceTime,minutes); if(!bucket){skipped++;return;} const key=`${direction}|${terminal}|${bucket}`;
      if(!groups.has(key))groups.set(key,{direction,terminal,bucket,members:[]}); groups.get(key).members.push(attendee);
    };
    state.attendees.forEach(attendee=>{
      add(attendee,"pickup",normalizeTerminal(attendee.outTo),attendee.outDate&&attendee.outArrival?`${attendee.outDate} ${attendee.outArrival}`:"",attendee.outNo);
      add(attendee,"dropoff",normalizeTerminal(attendee.returnFrom),recommendedDropoffTime(attendee),attendee.returnNo);
    });
    groups.forEach(group=>{const batchId=crypto.randomUUID();const label=group.direction==="pickup"?"接机/接站":"送机/送站";const batchName=`${group.bucket.slice(5)} ${group.terminal} ${label}`;group.members.forEach(attendee=>{const serviceTime=group.direction==="pickup"?`${attendee.outDate} ${attendee.outArrival}`:recommendedDropoffTime(attendee);attendee.transport[group.direction]={batchId,batchName,mode:"suggested",staffName:"",driver:"待分配",phone:"—",vehicle:"待分配",time:serviceTime,point:group.direction==="pickup"?`${group.terminal}到达口`:"会议酒店大堂",terminal:group.terminal,capacity:group.members.length,notes:"系统按站点和班次时间自动排列，待会务负责人确认",timeStrategy:group.direction==="pickup"?"arrival":"suggested"};});});
    const arranged=[...groups.values()].reduce((sum,group)=>sum+group.members.length,0); addNotification("change",`${currentUser().name}自动排列接送表：生成${groups.size}个建议批次、${arranged}人次`); saveState(); renderAll(); toast(`已生成 ${groups.size} 个建议批次、安排 ${arranged} 人次${skipped?`；${skipped}人次因站点或时间不明确未排列`:""}`);
  }

  function transportBatchGroups(list=visibleAttendees()) {
    const groups=new Map();
    list.forEach(attendee=>["pickup","dropoff"].forEach(direction=>{ const item=attendee.transport?.[direction]; if(!item?.batchId)return; if(!groups.has(item.batchId))groups.set(item.batchId,{id:item.batchId,direction,item,members:[]}); groups.get(item.batchId).members.push(attendee); }));
    return [...groups.values()];
  }

  function renderTransportBatches(list) {
    const groups=transportBatchGroups(list).filter(group=>activeTransportFilter==="all"||group.direction===activeTransportFilter);
    $("#transportBatchList").innerHTML=groups.map(group=>{ const {item,members,direction}=group; const staff=isStaffTransport(item); const capacity=Number(item.capacity)||members.length; return `<article class="batch-summary-card" style="--batch-color:${direction==="pickup"?"#9b62b4":"#5267d9"}"><div class="batch-summary-head"><span class="batch-summary-icon">${direction==="pickup"?"⌁":"↗"}</span><span class="status status-normal">${direction==="pickup"?"接机批次":"送机批次"}</span></div><h3>${escapeHtml(item.batchName||"未命名批次")}</h3><p>${escapeHtml(item.terminal||"地点待设置")} · ${staff?escapeHtml(item.staffName||"工作人员"):escapeHtml(item.vehicle||"车辆待定")}</p><div class="batch-summary-meta"><div><small>统一时间</small><strong>${escapeHtml(item.timeStrategy==="arrival"?"按抵达时间":item.time||"待设置")}</strong></div><div><small>已安排人数</small><strong>${members.length} / ${capacity}</strong></div></div><div class="batch-summary-actions"><button class="button button-secondary" data-edit-batch="${group.id}" ${canManage()?"":"disabled"}>编辑批次</button></div></article>`; }).join("");
    $$('[data-edit-batch]').forEach(button=>button.onclick=()=>openTransportBatch(null,button.dataset.editBatch));
  }

  function transportIsAssigned(item={}) { return isStaffTransport(item)||(item.driver&&item.driver!=="待分配"); }
  function batchRouteValue(attendee,direction,key) { if(key==="date")return direction==="pickup"?attendee.outDate:attendee.returnDate; if(key==="city")return direction==="pickup"?attendee.outTo:attendee.returnFrom; return ""; }

  function openTransportBatch(direction,batchId="") {
    if(!canManage())return deny(); if(state.locks.master)return toast("全名单已锁定，不能调整接送批次","error");
    const form=$("#transportBatchForm"); form.reset(); form.elements.batchId.value=batchId;
    const group=batchId?transportBatchGroups(state.attendees).find(item=>item.id===batchId):null; direction=direction||group?.direction||"pickup"; form.elements.direction.value=direction;
    $("#batchDialogTitle").textContent=direction==="pickup"?"批量接机 / 接站":"批量送机 / 送站";
    const strategy=form.elements.timeStrategy; strategy.options[0].textContent=direction==="pickup"?"按每人航班 / 车次抵达时间":"按每人建议送机 / 送站时间"; strategy.value=direction==="pickup"?"arrival":"fixed";
    const cities=[...new Set(state.attendees.map(a=>batchRouteValue(a,direction,"city")).filter(Boolean))]; $("#transportTerminals").innerHTML=cities.map(city=>`<option value="${escapeHtml(city)}"></option>`).join("");
    if(group){ const item=group.item; const first=group.members[0]; Object.entries({batchName:item.batchName,serviceDate:batchRouteValue(first,direction,"date"),terminal:item.terminal,timeStrategy:item.timeStrategy||"fixed",serviceClock:String(item.time||"").match(/(\d{2}:\d{2})/)?.[1]||"",mode:item.mode|| (isStaffTransport(item)?"staff":"driver"),staffName:item.staffName,staffPhone:isStaffTransport(item)?item.phone:"",placard:item.placard,driver:!isStaffTransport(item)?item.driver:"",driverPhone:!isStaffTransport(item)?item.phone:"",vehicle:item.vehicle,point:item.point,capacity:item.capacity||group.members.length,notes:item.notes}).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=value??"";}); }
    else { const first=state.attendees[0]; form.elements.serviceDate.value=batchRouteValue(first||{},direction,"date")||""; form.elements.capacity.value=direction==="pickup"?50:7; form.elements.mode.value="staff"; }
    toggleBatchModeFields(); renderBatchCandidates(); $("#transportBatchDialog").showModal();
  }

  function toggleBatchModeFields() {
    const form=$("#transportBatchForm"); const staff=form.elements.mode.value==="staff"; $("#batchStaffFields").classList.toggle("is-hidden",!staff); $("#batchDriverFields").classList.toggle("is-hidden",staff);
    [form.elements.staffName,form.elements.staffPhone].forEach(input=>input.required=staff); [form.elements.driver,form.elements.driverPhone,form.elements.vehicle].forEach(input=>input.required=!staff);
    const fixed=form.elements.timeStrategy.value==="fixed"; $("#batchClockField").classList.toggle("is-hidden",!fixed); form.elements.serviceClock.required=fixed;
  }

  function renderBatchCandidates() {
    const form=$("#transportBatchForm"); const direction=form.elements.direction.value||"pickup"; const date=form.elements.serviceDate.value; const terminal=form.elements.terminal.value.trim(); const editingId=form.elements.batchId.value;
    toggleBatchModeFields();
    if(!date){ $("#batchAttendeeList").innerHTML=`<div class="batch-empty">请先选择日期</div>`; return updateBatchCapacityNotice(); }
    const matches=state.attendees.filter(attendee=>{ const city=batchRouteValue(attendee,direction,"city"); const terminalMatch=!terminal||terminal.includes(city)||city.includes(terminal); return batchRouteValue(attendee,direction,"date")===date&&terminalMatch; });
    $("#batchAttendeeList").innerHTML=matches.length?matches.map(attendee=>{ const item=attendee.transport?.[direction]||{}; const conflict=transportIsAssigned(item)&&item.batchId!==editingId; const checked=item.batchId===editingId; const locked=isLocked(attendee); const trip=direction==="pickup"?`${attendee.outNo} · ${attendee.outArrival}抵达`:`${attendee.returnNo} · ${attendee.returnDeparture}出发`; return `<label class="batch-attendee-option"><input type="checkbox" name="batchAttendee" value="${attendee.id}" ${checked?"checked":""} ${locked?"disabled":""}/><p><strong>${escapeHtml(attendee.name)}</strong><small>${escapeHtml(trip)} · ${escapeHtml(batchRouteValue(attendee,direction,"city"))}</small></p><span class="${conflict?"assigned-warning":""}">${locked?"已锁定":conflict?`已有${direction==="pickup"?"接机":"送机"}安排`:checked?"本批次":"可加入"}</span></label>`; }).join(""):`<div class="batch-empty">没有符合该日期和地点的参会者</div>`;
    $$('[name="batchAttendee"]',$("#batchAttendeeList")).forEach(input=>input.addEventListener("change",updateBatchCapacityNotice)); $("#selectAllBatchAttendees").checked=false; updateBatchCapacityNotice();
  }

  function updateBatchCapacityNotice() {
    const selected=$$('[name="batchAttendee"]:checked',$("#batchAttendeeList")).length; const capacity=Number($("#transportBatchForm").elements.capacity.value)||0; const notice=$("#batchCapacityNotice"); notice.classList.toggle("warning",selected>capacity); notice.textContent=selected>capacity?`已选择 ${selected} 人，超过人数上限 ${capacity} 人，请减少人员或调整车辆容量。`:`已选择 ${selected} 人 · 剩余容量 ${Math.max(0,capacity-selected)} 人`;
  }

  function resetTransportAssignment(attendee,direction) {
    attendee.transport[direction]=direction==="pickup"?{driver:"待分配",phone:"—",vehicle:"待分配",time:attendee.outDate&&attendee.outArrival?`${attendee.outDate} ${attendee.outArrival}`:"待设置",point:attendee.outTo?`${attendee.outTo}到达口`:"待设置"}:{driver:"待分配",phone:"—",vehicle:"待分配",time:recommendedDropoffTime(attendee)||"待设置",point:"会议酒店大堂"};
  }

  function saveTransportBatch(event) {
    event.preventDefault(); if(!canManage()||state.locks.master)return toast("当前不能调整接送批次","error");
    const form=event.currentTarget; const data=Object.fromEntries(new FormData(form)); const selectedIds=$$('[name="batchAttendee"]:checked',$("#batchAttendeeList")).map(input=>input.value); const capacity=Number(data.capacity)||0;
    if(!selectedIds.length)return toast("请至少选择一位参会者","error"); if(selectedIds.length>capacity)return toast("选择人数超过批次人数上限","error");
    const direction=data.direction; const conflicts=selectedIds.map(id=>state.attendees.find(a=>a.id===id)).filter(a=>{const item=a?.transport?.[direction]||{};return transportIsAssigned(item)&&item.batchId!==data.batchId;});
    if(conflicts.length&&!confirm(`${conflicts.length} 位参会者已有安排，确认覆盖并加入新批次吗？`))return;
    const batchId=data.batchId||crypto.randomUUID();
    if(data.batchId) transportBatchGroups(state.attendees).find(group=>group.id===data.batchId)?.members.filter(member=>!selectedIds.includes(member.id)).forEach(member=>resetTransportAssignment(member,direction));
    selectedIds.forEach(id=>{ const attendee=state.attendees.find(item=>item.id===id); const time=data.timeStrategy==="fixed"?`${data.serviceDate} ${data.serviceClock}`:direction==="pickup"?`${attendee.outDate} ${attendee.outArrival}`:recommendedDropoffTime(attendee); attendee.transport[direction]={batchId,batchName:data.batchName,mode:data.mode,staffName:data.mode==="staff"?data.staffName:"",driver:data.mode==="staff"?"会务工作人员":data.driver,phone:data.mode==="staff"?data.staffPhone:data.driverPhone,vehicle:data.mode==="staff"?"":data.vehicle,time:time||"待设置",point:data.point,terminal:data.terminal,placard:data.mode==="staff"?data.placard:"",capacity,notes:data.notes,timeStrategy:data.timeStrategy}; });
    addNotification("change",`${currentUser().name}${data.batchId?"更新":"创建"}了${data.batchName}，共安排${selectedIds.length}人`); saveState(); $("#transportBatchDialog").close(); renderAll(); toast(`接送批次已保存，共 ${selectedIds.length} 人`);
  }

  function renderLocks() {
    $("#masterLock").checked = state.locks.master; $("#masterLock").disabled = !canManage();
    $("#columnLocks").innerHTML = COLUMN_LOCKS.map(([key,label]) => `<label class="lock-chip"><input type="checkbox" data-column-lock="${key}" ${state.locks.columns.includes(key) ? "checked" : ""} ${canManage() ? "" : "disabled"}/> ${label}</label>`).join("");
    $("#rowLocks").innerHTML = visibleAttendees().map(a => `<div class="row-lock-item"><span class="person-avatar">${escapeHtml(a.name[0])}</span><p><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.hospital)} · ${escapeHtml(userName(a.ownerId))}</small></p><label class="switch"><input type="checkbox" data-row-lock="${a.id}" ${state.locks.rows.includes(a.id) ? "checked" : ""} ${canEditAttendeeData() ? "" : "disabled"}/><span></span></label></div>`).join("");
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
    const values = { eventName:state.settings.eventName, clientName:state.settings.clientName, startDate:state.settings.startDate, endDate:state.settings.endDate, venues:state.settings.venues.map(normalizeVenueLabel).filter(Boolean).join("、"), deadline:state.settings.deadline, capacity:state.settings.capacity, servicePhone:state.settings.servicePhone, allowedCities:state.settings.allowedCities.join("、"), flightLeadMinutes:state.settings.flightLeadMinutes, trainLeadMinutes:state.settings.trainLeadMinutes, transportGroupMinutes:state.settings.transportGroupMinutes||30 };
    Object.entries(values).forEach(([name,value]) => { if (form.elements[name]) form.elements[name].value=value??""; });
    form.elements.mismatchRule.checked = state.settings.mismatchRule; form.elements.departureRule.checked = state.settings.departureRule;
    const fieldNames = {fieldTitle:"title",fieldHcpId:"hcpId",fieldAccommodation:"accommodation",fieldFlight:"flight",fieldMslContact:"mslContact",fieldRemarks:"remarks"};
    Object.entries(fieldNames).forEach(([name,key]) => form.elements[name].checked = state.settings.fieldConfig[key] !== false);
    const template=state.settings.registrationTemplate?.columns?.length ? state.settings.registrationTemplate : {columns:[]};
    const customCount=template.columns.filter(column=>column.custom).length;
    $("#templateStatus").innerHTML=state.settings.templateImported?`<strong>${escapeHtml(state.settings.templateName||"已导入报名模板")}</strong><small>${template.columns.filter(column=>column.key!=="sequence").length} 个报名字段${customCount?` · ${customCount} 个自定义字段`:""}</small>`:`<strong>尚未导入报名模板</strong><small>导入后才能开启项目报名</small>`;
    $("#templateColumns").innerHTML=template.columns.length?template.columns.filter(column=>column.key!=="sequence").map(column=>`<span class="${column.custom?"custom":""}">${escapeHtml(column.header.replace(/\s+/g," "))}${column.required?" *":""}</span>`).join(""):`<span>等待导入 Excel / CSV 模板</span>`;
    $$('input,textarea,select,button[type="submit"]', form).forEach(input => input.disabled = !canManage() && input.id !== "resetDemo");
    $("#projectTemplateFile").disabled=!canManage(); $("#resetProjectTemplate").disabled=!canManage()||!state.settings.templateImported||state.settings.registrationOpen;
    $("#registrationOpenSwitch").checked=!!state.settings.registrationOpen;$("#registrationOpenSwitch").disabled=!canManage()||(!state.settings.templateImported&&!state.settings.registrationOpen);
    $("#registrationOpenStatus").textContent=state.settings.registrationOpen?"报名开放":"报名关闭";$("#registrationOpenStatus").className=`status ${state.settings.registrationOpen?"status-ok":"status-locked"}`;
    $("#registrationOpenHint").textContent=state.settings.templateImported?(state.settings.registrationOpen?"当前允许公开端新增报名":"关闭后仍可更改已报名和查询参会信息"):"必须先导入报名表模板";
    $("#managerEditSwitch").checked=!!state.settings.managerEditEnabled;$("#managerEditSwitch").disabled=!(isSystemAdmin()||currentProject()?.ownerUserId===state.currentUserId);
    renderSettingsQuotaSummary();
    renderSystemStaffDirectory();
    $("#resetDemo").classList.toggle("is-hidden", !!backend);
  }

  function renderSettingsQuotaSummary() {
    const rows=state.settings.registrationQuotas||[];
    const total=rows.reduce((sum,row)=>sum+quotaNumber(row.quota),0);
    const capacity=quotaNumber(state.settings.capacity);
    const difference=capacity-total;
    const venues=new Set(rows.map(row=>normalizeVenueLabel(row.venue)).filter(Boolean)).size;
    const regions=new Set([...(state.settings.quotaRegions||[]),...rows.map(row=>normalizeQuotaRegion(row.region))].filter(Boolean)).size;
    const status=$("#quotaSettingsStatus");
    status.textContent=!rows.length?"尚未配置":difference===0?"分配完成":difference>0?`待分配 ${difference}`:`超配 ${Math.abs(difference)}`;
    status.className=`status ${!rows.length?"status-locked":difference===0?"status-ok":difference>0?"status-pending":"status-alert"}`;
    $("#quotaSettingsSummary").innerHTML=`<div><small>会议总名额</small><strong>${capacity}</strong></div><div><small>已分配名额</small><strong>${total}</strong></div><div><small>涉及会场</small><strong>${venues}</strong></div><div><small>预设大区</small><strong>${regions}</strong></div>`;
    $("#editQuotasFromSettings").disabled=!canManage();
  }

  function bindDynamicButtons() {
    $$('[data-open-attendee]').forEach(button => button.onclick = () => openAttendee(button.dataset.openAttendee));
    $$('[data-approve]').forEach(button => button.onclick = () => approveAttendee(button.dataset.approve,button.dataset.segment));
    $$('[data-reject]').forEach(button => button.onclick = () => rejectAttendee(button.dataset.reject,button.dataset.segment));
    $$('[data-edit-transport]').forEach(button => button.onclick = () => editTransport(button.dataset.editTransport, button.dataset.type));
  }

  function openAttendee(id) {
    const a = state.attendees.find(item => item.id === id); if (!a) return;
    const locked = isLocked(a); const canEdit = !locked && canEditAttendeeData() && (canManage() || isSystemAdmin() || a.ownerId === currentUser().id);
    $("#attendeeDetail").innerHTML = `<div class="detail-head"><span class="kicker" style="color:#b9ddc5">ATTENDEE DETAIL</span><h2>${escapeHtml(a.name)}</h2><p>${escapeHtml(a.hospital)} · ${escapeHtml(a.department)} · ${escapeHtml(userName(a.ownerId))}负责</p></div><div class="detail-body"><div class="detail-grid"><div class="detail-block"><small>手机号</small><strong>${escapeHtml(a.phone)}</strong></div><div class="detail-block"><small>客户编号</small><strong>${escapeHtml(a.hcpId)}</strong></div><div class="detail-block"><small>去程</small><strong>${escapeHtml(a.outNo)} · ${fmtDate(a.outDate)} ${escapeHtml(a.outDeparture)}</strong></div><div class="detail-block"><small>返程</small><strong>${escapeHtml(a.returnNo)} · ${fmtDate(a.returnDate)} ${escapeHtml(a.returnDeparture)}</strong></div><div class="detail-block"><small>去程路线</small><strong>${escapeHtml(a.outFrom)} → ${escapeHtml(a.outTo)}</strong></div><div class="detail-block"><small>返程路线</small><strong>${escapeHtml(a.returnFrom)} → ${escapeHtml(a.returnTo)}</strong></div></div>${verificationDetails(a)}${a.risks.length ? `<div class="risk-preview warning">${a.risks.map(r => `△ ${escapeHtml(r)}`).join("<br>")}</div>` : `<div class="risk-preview ok">✓ 当前行程符合预设规则</div>`}<div class="detail-actions">${canEdit ? `<button class="button button-primary" id="editTripButton">修改行程</button>` : `<span class="status status-locked">${locked ? "名单已锁定" : "无修改权限"}</span>`}<button class="button button-secondary" id="closeDetailButton">关闭</button></div></div>`;
    const dialog = $("#attendeeDialog"); dialog.showModal(); $("#closeDetailButton").onclick = () => dialog.close(); if (canEdit) $("#editTripButton").onclick = () => showTripEditor(a);
  }

  function showTripEditor(a) {
    $("#attendeeDetail").innerHTML = `<div class="detail-head"><span class="kicker" style="color:#b9ddc5">EDIT TRAVEL</span><h2>修改 ${escapeHtml(a.name)} 的行程</h2><p>请填写具体机场航站楼或高铁站；保存后重新进入异常核查。</p></div><form class="detail-body" id="tripEditForm"><div class="field-grid"><label>去程日期<input name="outDate" type="date" value="${escapeHtml(a.outDate)}" required></label><label>去程航班 / 车次<input name="outNo" value="${escapeHtml(a.outNo)}" required></label><label>去程出发机场 / 车站<input name="outFrom" value="${escapeHtml(a.outFrom)}" required></label><label>去程抵达机场 / 车站<input name="outTo" value="${escapeHtml(a.outTo)}" required></label><label>去程出发时间<input name="outDeparture" type="time" value="${escapeHtml(a.outDeparture)}" required></label><label>去程抵达时间<input name="outArrival" type="time" value="${escapeHtml(a.outArrival)}" required></label><label>返程日期<input name="returnDate" type="date" value="${escapeHtml(a.returnDate)}" required></label><label>返程航班 / 车次<input name="returnNo" value="${escapeHtml(a.returnNo)}" required></label><label>返程出发机场 / 车站<input name="returnFrom" value="${escapeHtml(a.returnFrom)}" required></label><label>返程抵达机场 / 车站<input name="returnTo" value="${escapeHtml(a.returnTo)}" required></label><label>返程出发时间<input name="returnDeparture" type="time" value="${escapeHtml(a.returnDeparture)}" required></label><label>返程抵达时间<input name="returnArrival" type="time" value="${escapeHtml(a.returnArrival)}" required></label></div><div class="detail-actions"><button class="button button-primary" type="submit">保存并重新核验</button><button class="button button-secondary" type="button" id="cancelEdit">取消</button></div></form>`;
    $("#cancelEdit").onclick = () => openAttendee(a.id);
    $("#tripEditForm").onsubmit = event => {
      event.preventDefault(); const fd = new FormData(event.currentTarget); const changes = []; const changedSegments=new Set(); ["outDate","outFrom","outTo","outNo","outDeparture","outArrival","returnDate","returnFrom","returnTo","returnNo","returnDeparture","returnArrival"].forEach(key => { let next = fd.get(key); if(["outFrom","outTo","returnFrom","returnTo"].includes(key))next=normalizeTerminal(next); if (next !== a[key]) { changes.push(`${FIELD_LABELS[key]||key}：${a[key]||"空"} → ${next||"空"}`); changedSegments.add(key.startsWith("return")?"return":"outbound"); a[key] = next; } });
      if(changedSegments.size&&a.customFields?._travelVerification){const checks={...a.customFields._travelVerification};changedSegments.forEach(segment=>delete checks[segment]);a.customFields={...a.customFields,_travelVerification:checks};}
      refreshTravelApprovals(a,changedSegments); addNotification("change", `${currentUser().name}修改了${a.name}的行程：${changes.join("；")}`); saveState(); $("#attendeeDialog").close(); renderAll(); toast("行程已更新，原核验结果已失效并通知会务负责人重新核验");
    };
  }

  function approveAttendee(id,segment="outbound") { if (!canEditAttendeeData()) return deny(); const a = state.attendees.find(item => item.id === id); const key=segment==="return"?"returnApproval":"outboundApproval"; a[key]="approved"; syncAggregateApproval(a); addNotification("approval", `${a.name}的${segment==="return"?"返程":"去程"}异常行程已由${currentUser().name}审批通过`); saveState(); renderAll(); toast(`${segment==="return"?"返程":"去程"}行程已审批通过`); }
  function rejectAttendee(id,segment="outbound") { if (!canEditAttendeeData()) return deny(); const a = state.attendees.find(item => item.id === id); const key=segment==="return"?"returnApproval":"outboundApproval"; a[key]="rejected"; syncAggregateApproval(a); addNotification("approval", `${currentUser().name}退回了${a.name}的${segment==="return"?"返程":"去程"}异常行程，请负责人修改`); saveState(); renderAll(); toast("已退回负责人修改"); }
  function deny() { toast("当前身份没有此操作权限", "error"); renderAll(); }

  function editTransport(id, type) {
    const a = state.attendees.find(item => item.id === id); const t = a.transport[type] || {}; const typeName = type === "pickup" ? "接机" : "送机";
    const suggested = type === "dropoff" ? recommendedDropoffTime(a) : "";
    const savedTime = !t.time || ["待设置","待分配"].includes(t.time) ? suggested : t.time;
    const currentMode = isStaffTransport(t) ? "staff" : "driver";
    $("#attendeeDetail").innerHTML = `<div class="detail-head"><span class="kicker" style="color:#e9d8f2">TRANSPORT</span><h2>${escapeHtml(a.name)} · ${typeName}</h2><p>单独修改后将退出原接送批次</p></div><form class="detail-body" id="transportEditForm"><div class="field-grid"><label class="span-2">接送方式<select name="mode" id="transportMode"><option value="staff" ${currentMode === "staff" ? "selected" : ""}>机场 / 车站工作人员接待</option><option value="driver" ${currentMode === "driver" ? "selected" : ""}>独立司机接送</option></select></label><div class="span-2 driver-fields" id="staffFields"><div class="field-grid"><label>工作人员姓名<input name="staffName" value="${escapeHtml(t.staffName||"")}"></label><label>工作人员电话<input name="staffPhone" value="${escapeHtml(currentMode==="staff"?t.phone||"":"")}"></label><label class="span-2">接机牌文字<input name="placard" value="${escapeHtml(t.placard||"")}"></label></div></div><div class="span-2 driver-fields" id="driverFields"><div class="field-grid"><label>司机姓名<input name="driver" value="${escapeHtml(currentMode === "driver" ? t.driver || "" : "")}"></label><label>司机电话<input name="driverPhone" value="${escapeHtml(currentMode === "driver" ? t.phone || "" : "")}"></label><label class="span-2">车辆 / 车牌<input name="vehicle" value="${escapeHtml(currentMode === "driver" ? t.vehicle || "" : "")}"></label></div></div><label>接送时间<input name="time" value="${escapeHtml(savedTime || "")}" placeholder="YYYY-MM-DD HH:mm" required></label><label>集合点<input name="point" value="${escapeHtml(t.point || "")}" required></label><label class="span-2">机场 / 高铁站<input name="terminal" value="${escapeHtml(t.terminal||"")}"></label></div>${type === "dropoff" ? `<div class="risk-preview ok">✓ 自动建议：${isFlightReturn(a) ? `机场按航班起飞前 ${state.settings.flightLeadMinutes} 分钟` : `高铁站按列车出发前 ${state.settings.trainLeadMinutes} 分钟`}，当前建议 ${escapeHtml(suggested || "请先补全返程日期与时间")}；可按城市路况手动调整。</div>` : `<div class="risk-preview">工作人员接待可填写姓名、电话和接机牌，无需车辆信息。</div>`}<div class="detail-actions"><button class="button button-primary" type="submit">保存安排</button><button class="button button-secondary" type="button" id="cancelTransport">取消</button></div></form>`;
    const dialog = $("#attendeeDialog"); dialog.showModal();
    const form = $("#transportEditForm"); const mode = $("#transportMode"); const driverFields = $("#driverFields"); const staffFields=$("#staffFields");
    const toggleDriverFields = () => { const show = mode.value === "driver"; driverFields.classList.toggle("is-hidden", !show); staffFields.classList.toggle("is-hidden",show); $$('input', driverFields).forEach(input => input.required = show); $$('input',staffFields).forEach(input=>input.required=false); };
    mode.onchange = toggleDriverFields; toggleDriverFields(); $("#cancelTransport").onclick = () => dialog.close();
    form.onsubmit = event => { event.preventDefault(); if(t.batchId&&!confirm("单独修改后该参会者将退出原接送批次，是否继续？"))return; const values = Object.fromEntries(new FormData(form)); a.transport[type] = values.mode === "staff" ? { mode:"staff",staffName:values.staffName,driver:"会务工作人员",phone:values.staffPhone,vehicle:"",placard:values.placard,time:values.time,point:values.point,terminal:values.terminal } : { mode:"driver",driver:values.driver,phone:values.driverPhone,vehicle:values.vehicle,time:values.time,point:values.point,terminal:values.terminal }; addNotification("change", `${currentUser().name}更新了${a.name}的${typeName}安排`); saveState(); dialog.close(); renderAll(); toast(`${typeName}安排已更新`); };
  }

  function isStaffTransport(item = {}) { return item.mode === "staff" || item.service_mode === "staff" || item.driver === "会务工作人员" || item.driver_name === "会务工作人员"; }
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

  async function loadPublicProjectInfo() {
    if (!window.APP_CONFIG?.supabaseUrl) return;
    if(publicProjectLoadPromise)return publicProjectLoadPromise;
    publicProjectLoadPromise=(async()=>{
    const submit=$("#publicRegistrationForm").querySelector('button[type="submit"]'); submit.disabled=true;
    try {
      if (!currentEventSlug()) throw new Error("请选择报名项目");
      const response = await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`, { method:"POST", headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey}, body:JSON.stringify({action:"project-info",meeting:currentEventSlug()}) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "读取项目失败");
      publicProjectConfig = payload.project || null; applyPublicProject(publicProjectConfig); $("#publicProjectSelector").classList.add("is-hidden"); $("#publicRegistrationResult").innerHTML=""; submit.disabled=!publicProjectConfig?.newRegistrationAllowed;
    } catch (error) {
      await loadAvailablePublicProjects(error.message);
    } finally {
      publicProjectLoadedAt=Date.now();
    }
    })();
    try{return await publicProjectLoadPromise;}finally{publicProjectLoadPromise=null;}
  }

  async function loadAvailablePublicProjects(reason="请选择报名项目") {
    const response=await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`,{method:"POST",headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey},body:JSON.stringify({action:"list-projects"})});
    const payload=await response.json(); const projects=payload.projects || []; const submit=$("#publicRegistrationForm").querySelector('button[type="submit"]');
    if (!response.ok || !projects.length) { $("#publicProjectName").textContent="暂无可用项目"; $("#publicRegistrationResult").innerHTML=`<div class="lookup-error">${escapeHtml(payload.error || reason)}，请联系会务负责人。</div>`; submit.disabled=true; return; }
    if (projects.length===1) { const url=new URL(location.href); url.searchParams.set("event",projects[0].slug); history.replaceState(null,"",url); publicProjectConfig=projects[0]; applyPublicProject(projects[0]); submit.disabled=!projects[0].newRegistrationAllowed; return; }
    $("#publicProjectName").textContent="请选择要报名的项目"; $("#publicRegistrationResult").innerHTML=`<div class="lookup-error">${escapeHtml(reason)}。请选择项目后再进入报名名单。</div>`;
    const selector=$("#publicProjectSelector"); selector.innerHTML=`<option value="">请选择项目</option>${projects.map(project=>`<option value="${escapeHtml(project.slug)}">${escapeHtml(project.name)}</option>`).join("")}`; selector.classList.remove("is-hidden"); selector.onchange=()=>{ if(!selector.value)return; const url=new URL(location.href); url.searchParams.set("event",selector.value); history.replaceState(null,"",url); publicProjectConfig=null; loadPublicProjectInfo(); }; submit.disabled=true;
  }

  function submitRegistration(event) {
    event.preventDefault(); if(!activeManagementOpen())return toast("项目报名与行程模块尚未开放","error");if(!canEditAttendeeData())return toast("当前账号仅有查看权限，请由原始填报人修改或开启管理员编辑权限","error");if (state.locks.master) return toast("全名单已锁定，不能新增报名", "error");
    const data = Object.fromEntries(new FormData(event.currentTarget)); data.phone = normalizePhone(data.phone); if (data.phone.length !== 11) return toast("请输入正确的 11 位手机号", "error");
    if (state.attendees.some(a => a.phone === data.phone)) return toast("该手机号已存在报名记录", "error");
    data.id = backend ? crypto.randomUUID() : `a-${Date.now()}`; data.ownerId = currentUser().role === "sales" ? currentUser().id : (data.ownerId || state.users.find(u => u.role === "sales")?.id || currentUser().id); refreshTravelApprovals(data); data.privacyLetterStatus="pending"; data.ticketStatus="pending"; data.customFields={}; data.createdAt = new Date().toISOString(); data.transport = { pickup: { driver: "待分配", phone: "—", vehicle: "待分配", time: `${data.outDate} ${data.outArrival}`, point: `${data.outTo}到达口` }, dropoff: { driver: "待分配", phone: "—", vehicle: "待分配", time: recommendedDropoffTime(data), point: "会议酒店大堂" } };
    state.attendees.unshift(data); addNotification("create", `${currentUser().name}新增报名：${data.name} · ${data.venue}${data.risks.length ? "（行程待审批）" : ""}`); saveState(); event.currentTarget.reset(); renderAll(); toast(data.risks.length ? "报名已保存，异常行程已提交审批" : "报名已保存"); location.hash = "attendees";
  }

  async function submitPublicRegistration(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode=form.id==="publicManageForm"?"manage":"register";
    const result = mode==="manage"?$("#publicManageResult"):$("#publicRegistrationResult");
    const submit = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    if(!String(data.region||"").trim()||!String(data.name||"").trim()||!String(data.employeeNo||"").trim()){result.innerHTML=`<div class="lookup-error">请完整填写大区、姓名和员工编号。</div>`;return;}
    if(mode==="register"&&!publicProjectConfig?.newRegistrationAllowed){result.innerHTML=`<div class="lookup-error">当前项目已暂停新增报名，您可使用“更改已报名”或“参会信息查询”。</div>`;return;}
    if (!window.APP_CONFIG?.supabaseUrl) { result.innerHTML = `<div class="lookup-error">报名服务暂不可用，请联系会务负责人。</div>`; return; }
    submit.disabled = true; submit.textContent = "正在进入…";
    try {
      const response = await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`, {
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey},
        body:JSON.stringify({action:"registrant-login",meeting:currentEventSlug(),region:data.region,name:data.name,employeeNo:data.employeeNo,mode}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "进入失败");
      publicAuthSession = { ...payload.registrant, sessionToken:payload.sessionToken, mode }; publicProjectConfig = payload.project || publicProjectConfig; publicRegistrantAttendees = payload.attendees || []; applyPublicProject(publicProjectConfig);
      enterRegistrantWorkspace(mode);
    } catch (error) { result.innerHTML = `<div class="lookup-error">${escapeHtml(error.message)}</div>`; }
    finally { submit.disabled = false; submit.innerHTML = mode==="manage"?`查看我提交的报名 <span>→</span>`:`进入报名填报页面 <span>→</span>`; }
  }

  function enterRegistrantWorkspace(mode="register") {
    $("#publicRegistrationResult").innerHTML = "";$("#publicManageResult").innerHTML=""; $("#publicAuthStep").classList.add("is-hidden"); $("#publicFullRegistrationStep").classList.remove("is-hidden"); $(".portal-card").classList.add("expanded","workspace-mode");$('[data-portal-panel="register"]').classList.remove("is-hidden");$('[data-portal-panel="manage"]').classList.add("is-hidden");
    $("#publicRegistrantIdentity").textContent = `${publicAuthSession.region} · ${publicAuthSession.name} · 员工编号 ${publicAuthSession.employeeNo}`;
    $("#publicRegistrantProject").textContent = `当前项目：${publicProjectConfig?.name || currentEventSlug()}`;
    $("#newPublicAttendee").classList.toggle("is-hidden",mode==="manage");$("#newPublicAttendee").disabled=mode==="manage"||!publicProjectConfig?.newRegistrationAllowed||!!publicProjectConfig?.masterLocked;
    renderPublicAttendeeList(); closePublicAttendeeEditor();
    if (mode==="register"&&!publicRegistrantAttendees.length&&publicProjectConfig?.newRegistrationAllowed) openPublicAttendeeEditor();
    scrollTo({top:0,behavior:"smooth"});
  }

  function renderPublicAttendeeList() {
    const list=$("#publicAttendeeList");
    if (!publicRegistrantAttendees.length) { list.innerHTML=`<div class="public-attendee-empty"><strong>暂无您提交的参会报名数据</strong><small>${publicAuthSession?.mode==="manage"?"请确认填报人身份，或联系会务负责人进行数据移交":"点击“新增参会人员”开始填写报名表"}</small></div>`; return; }
    list.innerHTML=publicRegistrantAttendees.map(attendee=>`<article class="public-attendee-card ${attendee.businessStatus==="cancelled"?"cancelled":""}"><div class="public-attendee-card-main"><strong>${escapeHtml(attendee.name || "未命名参会人员")}</strong><small>${escapeHtml(attendee.hospital || "医院待填写")} · ${escapeHtml(attendee.venue || "会场待选择")} · ${escapeHtml(attendee.phone || "手机号待填写")}</small><span class="status ${attendee.businessStatus==="cancelled"||attendee.rowLocked ? "status-locked" : attendee.approval === "pending" ? "status-pending" : "status-ok"}">${attendee.businessStatus==="cancelled"?"已取消报名":attendee.rowLocked ? "名单已锁定" : attendee.approval === "pending" ? "行程待审批" : "可修改"}</span></div><div class="public-attendee-actions"><button class="button button-secondary" type="button" data-edit-public-attendee="${escapeHtml(attendee.id)}">${attendee.businessStatus==="cancelled"||attendee.rowLocked ? "查看" : "修改 / 更新"}</button>${attendee.businessStatus!=="cancelled"&&!attendee.rowLocked?`<button class="text-button danger" type="button" data-cancel-public-attendee="${escapeHtml(attendee.id)}">取消报名</button>`:""}</div></article>`).join("");
    $$('[data-edit-public-attendee]',list).forEach(button=>button.addEventListener("click",()=>openPublicAttendeeEditor(publicRegistrantAttendees.find(item=>item.id===button.dataset.editPublicAttendee))));
    $$('[data-cancel-public-attendee]',list).forEach(button=>button.addEventListener("click",()=>cancelPublicAttendee(button.dataset.cancelPublicAttendee)));
  }

  function openPublicAttendeeEditor(attendee = null) {
    if(!attendee&&!canOpenNewRegistration()&&window.APP_CONFIG?.mode!=="production")return toast("当前项目未开放新增报名","error");
    if(!attendee&&!publicProjectConfig?.newRegistrationAllowed&&window.APP_CONFIG?.mode==="production")return toast("当前项目已暂停新增报名","error");
    const form = $("#publicFullRegistrationForm");
    form.reset(); form.querySelectorAll("input,select,textarea").forEach(input=>input.disabled=false); form.querySelector('button[type="submit"]').classList.remove("is-hidden");
    publicEditingAttendeeId = attendee?.id || null;
    const aliases = { attendeeType:"attendeeType", name:"name", city:"city", hospital:"hospital", department:"department", title:"title", venue:"venue", sex:"sex", idNumber:"idNumber", phone:"phone", hcpId:"hcpId", accommodation:"accommodation", flight:"flight", region:"region", contactName:"contactName", contactMobile:"contactMobile", mslContact:"mslContact", remarks:"remarks", outDate:"outDate", outFrom:"outFrom", outTo:"outTo", outNo:"outNo", outDeparture:"outDeparture", outArrival:"outArrival", returnDate:"returnDate", returnFrom:"returnFrom", returnTo:"returnTo", returnNo:"returnNo", returnDeparture:"returnDeparture", returnArrival:"returnArrival" };
    Object.entries(aliases).forEach(([field,key]) => { if (form.elements[field]) form.elements[field].value = attendee?.[key] ?? (field === "attendeeType" ? "HCP" : ""); });
    form.elements.region.value = publicAuthSession.region; form.elements.contactName.value = publicAuthSession.name; form.elements.contactMobile.value = attendee?.contactMobile||"";
    applyPublicTemplate(publicProjectConfig?.registrationTemplate, publicProjectConfig?.templateName, attendee?.customFields||{});
    applyPublicFieldConfig(publicProjectConfig?.fieldConfig || {});
    const locked=attendee?.businessStatus==="cancelled"||!!attendee?.rowLocked || !!publicProjectConfig?.masterLocked; form.querySelectorAll("input,select,textarea").forEach(input=>input.disabled=locked || input.readOnly); form.querySelector('button[type="submit"]').classList.toggle("is-hidden",locked);
    $("#publicEditorTitle").textContent=attendee ? `${locked ? "查看" : "修改"}参会人员：${attendee.name}` : "新增参会人员";
    $("#publicFullRegistrationResult").innerHTML=""; $("#publicAttendeeEditor").classList.remove("is-hidden");
    $("#publicAttendeeEditor").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function applyPublicProject(project = {}) {
    if (!project) return;
    document.title = `礼来会议管理平台 · ${project.name || "参会服务"}`;
    $("#publicProjectName").textContent=project.name || "参会服务";
    const dateText=project.startDate ? `${fmtDate(project.startDate)}${project.endDate && project.endDate !== project.startDate ? ` — ${fmtDate(project.endDate)}` : ""}` : "待公布";
    $("#publicProjectDates").textContent=dateText; $("#publicProjectVenues").textContent=(project.venues || []).map(normalizeVenueLabel).filter(Boolean).join(" / ") || "待公布"; $("#publicProjectClient").textContent=project.clientName || project.name || "待公布";
    $("#publicProjectDeadline").textContent=project.deadline ? new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(project.deadline)) : "以会务通知为准";
    const footer=$(".public-footer"); if (footer) footer.textContent = project.servicePhone ? `会务服务台 ${project.servicePhone} · 工作时间 08:00–21:00` : "会务服务台 · 工作时间 08:00–21:00";
    const venueSelect=$("#publicFullRegistrationForm").elements.venue;
    if (venueSelect && project.venues?.length) { const selected=normalizeVenueLabel(venueSelect.value); const venues=[...new Set(project.venues.map(normalizeVenueLabel).filter(Boolean))]; venueSelect.innerHTML=`<option value="">请选择</option>${venues.map(venue=>`<option>${escapeHtml(venue)}</option>`).join("")}`; venueSelect.value=venues.includes(selected) ? selected : ""; }
    const registrationTab=$('[data-portal-tab="register"]');if(registrationTab){registrationTab.disabled=!project.newRegistrationAllowed;registrationTab.title=project.newRegistrationAllowed?"进入报名":"当前项目已暂停新增报名";}
    const registrationSubmit=$("#publicRegistrationForm")?.querySelector('button[type="submit"]');if(registrationSubmit)registrationSubmit.disabled=!project.newRegistrationAllowed;
    const currentPublicRoute=(location.hash||"#portal").slice(1);if(!project.newRegistrationAllowed&&["portal","register"].includes(currentPublicRoute)&&!publicAuthSession){history.replaceState(null,"",`${location.pathname}${location.search}#manage`);setPortalTab("manage");$("#publicManageResult").innerHTML=`<div class="lookup-error">当前项目已暂停新增报名；更改已报名和参会信息查询仍可正常使用。</div>`;}
    applyPublicTemplate(project.registrationTemplate,project.templateName,{});
  }

  function applyPublicTemplate(template,name,customValues={}) {
    const form=$("#publicFullRegistrationForm"); if (!form) return;
    const columns=template?.columns?.length ? template.columns : standardTemplate().columns;
    const included=new Map(columns.filter(column=>!column.custom).map(column=>[column.key,column]));
    CORE_AUTH_FIELDS.forEach(key=>{ if(!included.has(key)) included.set(key,{key,required:true}); });
    $$('[data-template-field]',form).forEach(label=>{
      const column=included.get(label.dataset.templateField); const visible=!!column;
      label.classList.toggle("is-hidden",!visible);
      $$('input,select,textarea',label).forEach(input=>{ input.required=visible && (CORE_AUTH_FIELDS.has(label.dataset.templateField)||!!column?.required); if(!visible&&!input.readOnly) input.value=""; });
    });
    $$('.public-form-section',form).forEach(section=>{ if(section.id!=="publicCustomFieldsSection") section.classList.toggle("is-hidden",!section.querySelector('[data-template-field]:not(.is-hidden)')); });
    const custom=columns.filter(column=>column.custom);
    $("#publicCustomFieldsSection").classList.toggle("is-hidden",!custom.length);
    $("#publicCustomFields").innerHTML=custom.map(column=>`<label>${escapeHtml(column.header)}${column.required?" *":""}<input name="custom__${escapeHtml(column.key)}" value="${escapeHtml(customValues[column.key]||"")}" ${column.required?"required":""} /></label>`).join("");
    $("#publicTemplateHint").textContent=name ? `当前项目模板：${name}` : "字段与当前项目报名模板一致";
  }

  function applyPublicFieldConfig(config = {}) {
    $$('[data-config-field]', $("#publicFullRegistrationForm")).forEach(label => {
      const visible = config[label.dataset.configField] !== false; label.classList.toggle("is-hidden", !visible);
      $$('input,select,textarea',label).forEach(input => { if (!visible) { input.dataset.wasRequired=String(input.required); input.required=false; input.value=""; } else if (input.dataset.wasRequired === "true") input.required=true; });
    });
  }

  function closePublicAttendeeEditor() {
    publicEditingAttendeeId=null; $("#publicAttendeeEditor").classList.add("is-hidden"); $("#publicFullRegistrationResult").innerHTML=""; renderPublicAttendeeList();
    $("#publicFullRegistrationStep").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function resetPublicRegistrationStep() {
    publicAuthSession=null; publicRegistrantAttendees=[]; publicEditingAttendeeId=null; const form=$("#publicFullRegistrationForm"); form.reset(); form.querySelectorAll("input,select,textarea").forEach(input=>input.disabled=false); form.querySelector('button[type="submit"]').classList.remove("is-hidden"); $("#publicAttendeeEditor").classList.add("is-hidden"); $("#publicFullRegistrationStep").classList.add("is-hidden"); $("#publicAuthStep").classList.remove("is-hidden"); $(".portal-card").classList.remove("expanded","workspace-mode"); $("#publicFullRegistrationResult").innerHTML="";
  }

  async function submitPublicFullRegistration(event) {
    event.preventDefault(); if (!publicAuthSession) return resetPublicRegistrationStep();
    const form = event.currentTarget; const result = $("#publicFullRegistrationResult"); const submit = form.querySelector('button[type="submit"]');
    const details = Object.fromEntries(new FormData(form));
    details.customFields={}; Object.keys(details).filter(key=>key.startsWith("custom__")).forEach(key=>{ details.customFields[key.slice(8)]=details[key]; delete details[key]; });
    details.phone = normalizePhone(details.phone); details.region=publicAuthSession.region; details.contactName=publicAuthSession.name;details.contactMobile=normalizePhone(details.contactMobile);
    if (details.phone.length !== 11) { result.innerHTML = `<div class="lookup-error">请输入正确的参会人员手机号。</div>`; return; }
    submit.disabled = true; submit.textContent = "正在保存…";
    try {
      const response = await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`, { method:"POST", headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey}, body:JSON.stringify({action:"save-attendee",meeting:currentEventSlug(),sessionToken:publicAuthSession.sessionToken,attendeeId:publicEditingAttendeeId,details}) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "提交失败");
      const index=publicRegistrantAttendees.findIndex(item=>item.id===payload.attendee.id); if(index>=0) publicRegistrantAttendees[index]=payload.attendee; else publicRegistrantAttendees.unshift(payload.attendee);
      renderPublicAttendeeList(); toast(payload.needsApproval ? "参会人员已保存，异常行程已提交审批" : "参会人员信息已保存"); closePublicAttendeeEditor();
    } catch (error) { result.innerHTML = `<div class="lookup-error">${escapeHtml(error.message)}</div>`; }
    finally { submit.disabled = false; if (!submit.classList.contains("is-hidden")) submit.textContent = "保存参会人员信息"; }
  }

  async function cancelPublicAttendee(attendeeId){
    const attendee=publicRegistrantAttendees.find(item=>item.id===attendeeId);if(!attendee||!confirm(`确认取消“${attendee.name}”的报名？记录会保留用于统计对账。`))return;
    try{const response=await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`,{method:"POST",headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey},body:JSON.stringify({action:"cancel-attendee",meeting:currentEventSlug(),sessionToken:publicAuthSession.sessionToken,attendeeId})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"取消失败");attendee.businessStatus="cancelled";renderPublicAttendeeList();toast("报名已取消，历史记录已保留");}catch(error){toast(error.message||"取消报名失败","error");}
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
        result.innerHTML = renderLookupResult(payload.attendee, payload.outbound, payload.returnTrip, pickup, dropoff, payload.project);
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
    result.innerHTML = renderLookupResult({name:maskName(a.name),venue:a.venue,accommodation:a.accommodation==="Y"?"需要住宿":"无需住宿",hotel:a.customFields?.hotel||"待公布"}, outbound, returnTrip, pickup, dropoff, state.settings);
    lastLookupSchedule = buildLookupSchedule(a.name, pickup, dropoff);
    $("#addCalendarButton")?.addEventListener("click", downloadCalendar);
  }

  function renderLookupResult(attendeeInfo, outbound = {}, returnTrip = {}, pickup = {}, dropoff = {}, project = {}) {
    const info=typeof attendeeInfo==="string"?{name:attendeeInfo}:attendeeInfo||{};const name=info.name||"参会人员";
    const displayTime = value => { if (!value) return "待公布"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("zh-CN",{hour12:false}); };
    const card = (label, trip, t) => {
      const staff = isStaffTransport({...t,driver:t.driver || t.driver_name});
      const driver = staff ? `${t.staffName || t.staff_name || "会务工作人员现场接待"}${t.phone || t.driver_phone ? ` · ${t.phone || t.driver_phone}` : ""}` : `${t.driver || t.driver_name || "待分配"} · ${t.phone || t.driver_phone || "—"}`;
      const vehicle = staff ? "无需司机及车辆信息" : (t.vehicle || "待分配");
      return `<div class="result-card"><h3>${label} · ${escapeHtml(trip.number||"待公布")}</h3><p>${escapeHtml(trip.from||"")} → ${escapeHtml(trip.to||"")} · ${escapeHtml(trip.date||"")}</p><div class="result-route"><div><small>工作人员 / 司机</small><strong>${escapeHtml(driver)}</strong></div><div><small>车辆</small><strong>${escapeHtml(vehicle)}</strong></div><div><small>${label}时间</small><strong>${escapeHtml(displayTime(t.time || t.service_time))}</strong></div><div><small>集合点</small><strong>${escapeHtml(t.point || t.meeting_point || "待公布")}</strong></div>${t.terminal?`<div><small>机场 / 高铁站</small><strong>${escapeHtml(t.terminal)}</strong></div>`:""}${t.placard?`<div><small>接机牌</small><strong>${escapeHtml(t.placard)}</strong></div>`:""}</div></div>`;
    };
    return `<div class="lookup-name">${escapeHtml(name)}，你的参会安排如下</div><div class="participant-info-card"><div><small>会议</small><strong>${escapeHtml(project.name||project.eventName||"待公布")}</strong></div><div><small>会议日期</small><strong>${escapeHtml([project.startDate,project.endDate].filter(Boolean).join(" — ")||"待公布")}</strong></div><div><small>会场</small><strong>${escapeHtml(info.venue||"待公布")}</strong></div><div><small>住宿安排</small><strong>${escapeHtml(info.accommodation||"待公布")} · ${escapeHtml(info.hotel||"待公布")}</strong></div></div>${card("接机",outbound,pickup)}${card("送机",returnTrip,dropoff)}<div class="calendar-action"><strong>还差一步：开启手机自动提醒</strong><span>受手机隐私规则限制，网页不能静默写入日历。请点击并在系统弹窗中确认“添加全部”。</span><button class="button button-primary button-block calendar-button" id="addCalendarButton" type="button">加入手机日历 · 接送前 30 分钟提醒</button></div>`;
  }

  function buildLookupSchedule(name, pickup = {}, dropoff = {}) {
    const event = (label, t) => ({ title:`HEMA SEM ${label}提醒`, time:t.time || t.service_time || "", location:t.point || t.meeting_point || "", description:isStaffTransport({...t,driver:t.driver || t.driver_name}) ? `工作人员：${t.staffName||t.staff_name||"会务工作人员"}；电话：${t.phone||t.driver_phone||"—"}${t.placard?`；接机牌：${t.placard}`:""}` : `司机：${t.driver || t.driver_name || "待分配"}；电话：${t.phone || t.driver_phone || "—"}；车辆：${t.vehicle || "待分配"}` });
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
    Object.assign(state.settings,{ eventName:data.eventName, clientName:data.clientName, startDate:data.startDate, endDate:data.endDate, deadline:data.deadline, capacity:Number(data.capacity)||120, servicePhone:data.servicePhone, flightLeadMinutes:Number(data.flightLeadMinutes)||120, trainLeadMinutes:Number(data.trainLeadMinutes)||90, transportGroupMinutes:Math.min(180,Math.max(10,Number(data.transportGroupMinutes)||30)), venues:[...new Set(String(data.venues||"").split(/[、,，\s]+/).map(normalizeVenueLabel).filter(Boolean))], allowedCities:String(data.allowedCities||"").split(/[、,，\s]+/).map(v=>v.trim()).filter(Boolean), mismatchRule:!!data.mismatchRule, departureRule:!!data.departureRule, fieldConfig:{title:!!data.fieldTitle,hcpId:!!data.fieldHcpId,accommodation:!!data.fieldAccommodation,flight:!!data.fieldFlight,mslContact:!!data.fieldMslContact,remarks:!!data.fieldRemarks} });
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
  const normalizeHeader = value => cleanCell(value).toLowerCase().replace(/[\s\n\r*#()（）/._-]/g,"");
  function inferTemplateKey(header,index,total) {
    const text=normalizeHeader(header);
    if (/^(no|序号)$/.test(text)) return "sequence";
    const direct = [
      [/参会者类别|attendeetype/,"attendeeType"],[/销售联系人手机|contactmobile/,"contactMobile"],[/销售联系人姓名|contactname/,"contactName"],[/客户编号|hcpid/,"hcpId"],[/身份证|护照|passport|idpassport/,"idNumber"],[/手机号|mobilephone/,"phone"],[/客户姓名|姓名|name/,"name"],[/医院|连锁|hospital|chain/,"hospital"],[/科室|门店|department|store/,"department"],[/职称|title/,"title"],[/会场|venue/,"venue"],[/性别|sex/,"sex"],[/住宿|accommodation/,"accommodation"],[/是否航空|flightyn/,"flight"],[/返回日期|returndate/,"returnDate"],[/大区|region/,"region"],[/msl/,"mslContact"],[/备注|remarks?/,"remarks"],
    ];
    for (const [pattern,key] of direct) if (pattern.test(text)) return key;
    const isReturn=/返程|返回|return/.test(text) || index > Math.floor(total*.62);
    if (/出发日期|departuredate/.test(text)) return isReturn?"returnDate":"outDate";
    if (/出发城市|departurecity/.test(text)) return isReturn?"returnFrom":"outFrom";
    if (/到达城市|arrivalcity/.test(text)) return isReturn?"returnTo":"outTo";
    if (/航班|车次|flighttrainno/.test(text)) return isReturn?"returnNo":"outNo";
    if (/出发时间|departuretime/.test(text)) return isReturn?"returnDeparture":"outDeparture";
    if (/到达时间|arrivaltime/.test(text)) return isReturn?"returnArrival":"outArrival";
    if (/城市|city/.test(text)) return "city";
    return "";
  }
  function templateFromHeaders(headers) {
    const standardLike=headers.length>=30 && headers.some(value=>normalizeHeader(value).includes("客户姓名")) && headers.some(value=>normalizeHeader(value).includes("销售联系人手机"));
    const used=new Set();
    return {version:1,columns:headers.map((raw,index)=>{
      const header=cleanCell(raw)||`未命名字段 ${index+1}`;
      let key=standardLike && index<STANDARD_TEMPLATE_KEYS.length ? STANDARD_TEMPLATE_KEYS[index] : inferTemplateKey(header,index,headers.length);
      if (key && key!=="sequence" && used.has(key)) key="";
      if (key) used.add(key);
      const custom=!key; if (custom) key=`custom_${index}_${normalizeHeader(header).slice(0,18)||"field"}`;
      return {header,key,required:/\*/.test(header),custom};
    })};
  }
  const excelColumnIndex = letters => [...String(letters||"").toUpperCase()].reduce((total,char)=>total*26+char.charCodeAt(0)-64,0)-1;
  async function templateValidationOptions(buffer,sheetName) {
    if(!window.JSZip)return{};
    try {
      const zip=await JSZip.loadAsync(buffer); const parser=new DOMParser();
      const workbookXml=parser.parseFromString(await zip.file("xl/workbook.xml").async("text"),"application/xml");
      const sheet=[...workbookXml.getElementsByTagNameNS("*","sheet")].find(node=>node.getAttribute("name")===sheetName); if(!sheet)return{};
      const relId=sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id")||sheet.getAttribute("r:id");
      const relsXml=parser.parseFromString(await zip.file("xl/_rels/workbook.xml.rels").async("text"),"application/xml");
      const relationship=[...relsXml.getElementsByTagNameNS("*","Relationship")].find(node=>node.getAttribute("Id")===relId); if(!relationship)return{};
      const target=relationship.getAttribute("Target")||""; const sheetPath=target.startsWith("/")?target.slice(1):`xl/${target.replace(/^\.\//,"")}`;
      const sheetFile=zip.file(sheetPath); if(!sheetFile)return{}; const sheetXml=parser.parseFromString(await sheetFile.async("text"),"application/xml"); const options={};
      [...sheetXml.getElementsByTagNameNS("*","dataValidation")].forEach(rule=>{const formula=rule.getElementsByTagNameNS("*","formula1")[0]?.textContent?.trim()||"";const match=formula.match(/^"([\s\S]*)"$/);if(!match)return;const values=match[1].split(",").map(value=>value.trim()).filter(Boolean);if(!values.length)return;const ref=(rule.getAttribute("sqref")||"").split(/\s+/)[0];const column=ref.match(/\$?([A-Z]+)\$?\d+/i)?.[1];const index=excelColumnIndex(column);if(index>=0)options[index]=values;});
      return options;
    } catch { return {}; }
  }
  async function readProjectTemplate(file) {
    if (!file || !canManage()) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return toast("请选择 Excel 或 CSV 模板", "error");
    if (!window.XLSX) return toast("Excel 组件尚未加载，请刷新后重试", "error");
    try {
      const buffer=await file.arrayBuffer(); const workbook=XLSX.read(buffer,{type:"array",cellDates:true}); const sheet=workbook.Sheets[workbook.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:false});
      const headers=(rows.find(row=>row.filter(value=>cleanCell(value)).length>=2)||[]).map(cleanCell);
      if (headers.length<2) throw new Error("没有识别到模板表头");
      const template=templateFromHeaders(headers); const validationOptions=await templateValidationOptions(buffer,workbook.SheetNames[0]);
      template.columns.forEach((column,index)=>{if(validationOptions[index]?.length)column.options=validationOptions[index];});
      const venueOptions=template.columns.find(column=>column.key==="venue")?.options?.map(normalizeVenueLabel).filter(Boolean)||[];
      if(venueOptions.length)state.settings.venues=[...new Set(venueOptions)];
      if(backend){const{error}=await backend.rpc("save_project_registration_template",{p_meeting_id:backendMeetingId,p_template_name:file.name,p_template:template});if(error)throw error;if(venueOptions.length){const venueResult=await backend.from("meetings").update({venues:state.settings.venues}).eq("id",backendMeetingId);if(venueResult.error)throw venueResult.error;}}
      state.settings.templateName=file.name; state.settings.registrationTemplate=template;state.settings.templateImported=true;const project=currentProject();if(project)project.templateImported=true;
      addNotification("change",`${currentUser().name}为当前项目启用了报名模板：${file.name}`); saveState(); renderSettings(); toast(`模板已启用，共识别 ${headers.length} 列`);
    } catch(error) { toast(error.message||"模板读取失败","error"); }
    finally { $("#projectTemplateFile").value=""; }
  }
  async function resetProjectTemplate() {
    if (!canManage()) return;
    if(state.settings.registrationOpen)return toast("请先关闭报名开关，再删除模板","error");
    if (!confirm("确认删除当前项目报名模板？删除后需要重新导入才能开启报名。")) return;
    try{if(backend){const{error}=await backend.rpc("remove_project_registration_template",{p_meeting_id:backendMeetingId});if(error)throw error;}state.settings.templateName="";state.settings.registrationTemplate={version:1,columns:[]};state.settings.templateImported=false;const project=currentProject();if(project)project.templateImported=false;saveState();renderSettings();renderProjects();toast("报名模板已删除");}catch(error){toast(error.message||"模板删除失败","error");}
  }
  function excelDate(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
    if (typeof value === "number" && window.XLSX?.SSF) { const d=XLSX.SSF.parse_date_code(value); if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`; }
    const text=cleanCell(value).replace(/[年/.]/g,"-").replace(/月/g,"-").replace(/日/g,""); const match=text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
    return match ? `${match[1]}-${match[2].padStart(2,"0")}-${match[3].padStart(2,"0")}` : "";
  }
  function excelTime(value) {
    if (value === "" || value == null) return "";
    if (typeof value === "number") { const minutes=Math.round((value%1)*1440)%1440; return `${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`; }
    if (value instanceof Date) return `${String(value.getHours()).padStart(2,"0")}:${String(value.getMinutes()).padStart(2,"0")}`;
    const match=cleanCell(value).replaceAll("：",":").match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$)/); if(!match)return"";const hour=Number(match[1]);const minute=Number(match[2]);return hour<24&&minute<60?`${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`:"";
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
    const parsedTravel={outDate:excelDate(row[14]),outDeparture:excelTime(row[18]),outArrival:excelTime(row[19]),returnDate:excelDate(row[20]),returnDeparture:excelTime(row[24]),returnArrival:excelTime(row[25])};
    const travelNotes=[["去程日期",row[14],parsedTravel.outDate],["去程出发时间",row[18],parsedTravel.outDeparture],["去程抵达时间",row[19],parsedTravel.outArrival],["返程日期",row[20],parsedTravel.returnDate],["返程出发时间",row[24],parsedTravel.returnDeparture],["返程抵达时间",row[25],parsedTravel.returnArrival]].filter(([,raw,parsed])=>cleanCell(raw)&&!parsed).map(([label,raw])=>`${label}：${cleanCell(raw)}`);
    const importedRemarks=[cleanCell(row[30]),...travelNotes].filter(Boolean).join("；"); const customFields={...(existing?.customFields||{})}; if(travelNotes.length)customFields._importTravelNotes=travelNotes;
    const attendee={
      id:existing?.id || (backend ? crypto.randomUUID() : `a-${Date.now()}-${sheetRow}`), ownerId:matchedOwner?.id || existing?.ownerId || currentUser().id,
      attendeeType:cleanCell(row[1])||"HCP", name:cleanCell(row[2]), city:cleanCell(row[3]), hospital:cleanCell(row[4]), department:cleanCell(row[5]), title:cleanCell(row[6]), venue:normalizeVenueLabel(row[7]), sex:cleanCell(row[8]), idNumber:cleanCell(row[9]), phone, hcpId:cleanCell(row[11]), accommodation:yesNo(row[12]), flight:yesNo(row[13],/^[GDC]\d+/i.test(cleanCell(row[17]))?"N":"Y"),
      outDate:parsedTravel.outDate,outFrom:normalizeTerminal(cleanCell(row[15])),outTo:normalizeTerminal(cleanCell(row[16])),outNo:cleanCell(row[17]),outDeparture:parsedTravel.outDeparture,outArrival:parsedTravel.outArrival,returnDate:parsedTravel.returnDate,returnFrom:normalizeTerminal(cleanCell(row[21])),returnTo:normalizeTerminal(cleanCell(row[22])),returnNo:cleanCell(row[23]),returnDeparture:parsedTravel.returnDeparture,returnArrival:parsedTravel.returnArrival,region:cleanCell(row[26]),contactName:cleanCell(row[27]),contactMobile,mslContact:cleanCell(row[29]),remarks:importedRemarks,customFields,privacyLetterStatus:normalizePrivacyStatus(existing?.privacyLetterStatus),privacyLetterFilePath:existing?.privacyLetterFilePath||"",privacyLetterFileName:existing?.privacyLetterFileName||"",privacyLetterFileSize:existing?.privacyLetterFileSize||0,privacyLetterUploadedAt:existing?.privacyLetterUploadedAt||"",privacyLetterUploadedBy:existing?.privacyLetterUploadedBy||null,ticketStatus:existing?.ticketStatus||"pending",createdAt:existing?.createdAt||new Date().toISOString(),transport:existing?.transport||{pickup:{driver:"待分配",phone:"—",vehicle:"待分配",time:"待设置",point:"待设置"},dropoff:{driver:"待分配",phone:"—",vehicle:"待分配",time:"待设置",point:"会议酒店大堂"}},
    };
    const errors=[];
    if (!attendee.name) errors.push("缺少姓名"); if (phone.length!==11) errors.push("手机号格式错误"); if (!attendee.idNumber) errors.push("缺少证件号"); if (!attendee.hcpId) errors.push("缺少HCP ID");
    if (phone&&seen.has(phone)) errors.push("文件内手机号重复"); if (phone) seen.add(phone); if (existing&&isLocked(existing)) errors.push("已有记录已锁定");
    refreshTravelApprovals(attendee);
    if (!existing) { attendee.transport.pickup.time=attendee.outDate&&attendee.outArrival?`${attendee.outDate} ${attendee.outArrival}`:"待设置"; attendee.transport.pickup.point=attendee.outTo?`${attendee.outTo}到达口`:"待设置"; attendee.transport.dropoff.time=recommendedDropoffTime(attendee)||"待设置"; }
    return {attendee,sheetRow,status:errors.length?"error":existing?"update":"new",errors};
  }

  function renderImportPreview(fileName) {
    const valid=pendingImportRows.filter(row=>row.status!=="error"); const added=valid.filter(row=>row.status==="new").length; const updated=valid.length-added; const errors=pendingImportRows.length-valid.length;
    $("#importPreview").innerHTML=`<div class="import-summary"><div class="import-file-name"><span>XL</span><p><strong>${escapeHtml(fileName)}</strong><small>共读取 ${pendingImportRows.length} 行</small></p></div><div class="import-stats"><div class="stat-new"><strong>${added}</strong><small>新增</small></div><div class="stat-update"><strong>${updated}</strong><small>更新</small></div><div class="stat-error"><strong>${errors}</strong><small>错误</small></div></div></div><div class="import-table-wrap"><table class="import-table"><thead><tr><th>Excel行</th><th>参会者</th><th>城市 / 会场</th><th>负责人</th><th>状态</th></tr></thead><tbody>${pendingImportRows.slice(0,100).map(item=>`<tr><td>${item.sheetRow}</td><td><strong>${escapeHtml(item.attendee.name||"未填写")}</strong><small>${escapeHtml(item.attendee.phone||"无手机号")}</small></td><td>${escapeHtml(item.attendee.city||"—")}<small>${escapeHtml(item.attendee.venue||"—")}</small></td><td>${escapeHtml(userName(item.attendee.ownerId))}</td><td><span class="import-status ${item.status}">${item.status==="new"?"新增":item.status==="update"?"更新":escapeHtml(item.errors.join("、"))}</span></td></tr>`).join("")}</tbody></table></div>${pendingImportRows.length>100?`<p class="import-more">仅预览前100行，确认后将处理全部有效记录。</p>`:""}`;
    $("#confirmImport").disabled=!valid.length; $("#confirmImport").textContent=`确认导入 ${valid.length} 条有效名单`;
  }

  async function confirmRosterImport() {
    if (currentUser().role!=="ops"||state.locks.master) return toast("当前不能导入名单", "error");
    const valid=pendingImportRows.filter(row=>row.status!=="error"); if (!valid.length) return;
    const button=$("#confirmImport"); const originalLabel=button.textContent; button.disabled=true; button.textContent="正在保存到云端…";
    try {
      if (backend) {
        const attendeeResult=await backend.from("attendees").upsert(valid.map(({attendee})=>toDbAttendee(attendee)));
        if(attendeeResult.error)throw attendeeResult.error;
        const transportRows=valid.flatMap(({attendee})=>["pickup","dropoff"].map(direction=>{const t=attendee.transport?.[direction]||{};return{attendee_id:attendee.id,direction,driver_name:t.driver||null,staff_name:t.staffName||null,driver_phone:t.phone||null,vehicle:t.vehicle||null,service_time:parseServiceTime(t.time),meeting_point:t.point||null,service_mode:t.mode||null,batch_id:t.batchId||null,batch_name:t.batchName||null,terminal:t.terminal||null,placard:t.placard||null,capacity:t.capacity||null,notes:t.notes||null,time_strategy:t.timeStrategy||null};}));
        if(transportRows.length){const transportResult=await backend.from("transports").upsert(transportRows,{onConflict:"attendee_id,direction"});if(transportResult.error)throw transportResult.error;}
        await loadBackendState(backendMeetingId);
      } else {
        valid.forEach(({attendee})=>{const index=state.attendees.findIndex(item=>item.id===attendee.id);if(index>=0)state.attendees[index]=attendee;else state.attendees.unshift(attendee);});
      }
      const added=valid.filter(row=>row.status==="new").length; const updated=valid.length-added; addNotification("create",`${currentUser().name}导入线下名单：新增${added}人，更新${updated}人`);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); pendingImportRows=[]; $("#importDialog").close(); renderAll(); toast(backend?`已保存到云端：新增${added}人，更新${updated}人`:`已导入：新增${added}人，更新${updated}人`);
    } catch(error) {
      const message=error?.message||"云端保存失败"; button.disabled=false; button.textContent=originalLabel;
      $("#importPreview").insertAdjacentHTML("afterbegin",`<div class="lookup-error import-save-error">名单尚未保存，请勿刷新：${escapeHtml(message)}</div>`); toast(`导入失败：${message}`,"error");
    }
  }

  function exportExcel() {
    if(!isSystemAdmin()&&!['ops','client','sales'].includes(currentUser().role))return toast("当前账号没有导出权限","error");
    const columns=(state.settings.registrationTemplate?.columns?.length?state.settings.registrationTemplate:standardTemplate()).columns;
    const headers=[...columns.map(column=>column.header),"报名状态","隐私沟通函状态","去程审批状态","返程审批状态","出票状态","去程计划时刻核验","返程计划时刻核验"];
    const progressLabels={pending:"未完成",electronic:"已完成（隐私沟通函电子版）",paper:"已完成（隐私沟通函纸质版）",processing:"出票中",ticketed:"已出票",changed:"改签",refunded:"已退票"};
    const segmentLabels={normal:"无需审批",pending:"待审批",approved:"已审批",rejected:"已退回"};
    const rows=visibleAttendees().map((a,i)=>[...columns.map(column=>{
      if(column.key==="sequence") return i+1;
      if(column.key==="contactName") return a.contactName||userName(a.ownerId);
      if(column.key==="contactMobile") return a.contactMobile||state.users.find(u=>u.id===a.ownerId)?.phone||"";
      return column.custom ? a.customFields?.[column.key]||"" : a[column.key]||"";
    }),a.businessStatus==="cancelled"?"已取消报名":"有效报名",progressLabels[a.privacyLetterStatus||"pending"],segmentLabels[segmentApproval(a,"outbound")],segmentLabels[segmentApproval(a,"return")],progressLabels[a.ticketStatus||"pending"],verificationExport(a.customFields?._travelVerification?.outbound),verificationExport(a.customFields?._travelVerification?.return)]);
    if (window.XLSX) { const ws = XLSX.utils.aoa_to_sheet([headers,...rows]); ws["!cols"] = headers.map((_,i) => ({ wch: i === 0 ? 7 : 18 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"报名表"); XLSX.writeFile(wb,`${state.settings.slug||"项目"}-报名表-${new Date().toISOString().slice(0,10)}.xlsx`); toast("Excel 已按当前项目模板导出"); }
    else { const csv = [headers,...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv"})); link.download = "HEMA-SEM-报名表.csv"; link.click(); toast("已导出兼容 Excel 的 CSV 文件"); }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
