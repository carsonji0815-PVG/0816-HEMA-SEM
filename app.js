(() => {
  "use strict";

  const STORAGE_KEY = "journey-desk-state-v1";
  const COLUMN_LOCKS = [
    ["identity", "身份与证件"], ["contact", "手机号"], ["outbound", "去程"],
    ["return", "返程"], ["accommodation", "住宿"], ["transport", "接送机"], ["remarks", "备注"],
  ];
  const STANDARD_TEMPLATE_HEADERS = ["No.\n序号","Attendee Type\n参会者类别","Name\n客户姓名(姓/名)*","City\n城市","Hospital/Chain\n医院/连锁","Department/Store\n科室/门店","Title\n职称","会场\n（多城会议）","Sex\n性别","ID/Passpor No.*\n身份证号/护照号*","Mobile Phone #\n手机号","HCP ID*\n客户编号*","Accommodation\n住宿需求(Y/N)","Flight\n是否航空(Y/N)","Departure Date\n出发日期","Departure City 出发城市","Arrival City 到达城市","Flight/Train No.\n航班/车次号","Departure time 出发时间","Arrival time 到达时间","Return Date\n返回日期","Departure City 出发城市","Arrival City 到达城市","Flight/Train No.\n航班/车次号","Departure time 出发时间","Arrival time 到达时间","Region\n大区","Contact Name\n销售联系人姓名","Contact Mobile\n销售联系人手机","MSL医学部联系人","Remarks\n备注（本地客户/VIP异地用车备注）","Room Type\n住宿安排（单间/标间拼住/标间单住）"];
  const STANDARD_TEMPLATE_KEYS = ["sequence","attendeeType","name","city","hospital","department","title","venue","sex","idNumber","phone","hcpId","accommodation","flight","outDate","outFrom","outTo","outNo","outDeparture","outArrival","returnDate","returnFrom","returnTo","returnNo","returnDeparture","returnArrival","region","contactName","contactMobile","mslContact","remarks","roomType"];
  const CORE_AUTH_FIELDS = new Set(["name","phone","region"]);
  const JOURNEY_FORM_COLUMNS = [{key:"departDate",header:"出发日期"},{key:"departCity",header:"出发城市"},{key:"departTransportType",header:"出发出行方式"},{key:"departStation",header:"出发场站"},{key:"arriveDate",header:"抵达日期"},{key:"arriveCity",header:"抵达城市"},{key:"arriveTransportType",header:"抵达出行方式"},{key:"arriveStation",header:"抵达场站"},{key:"returnDepartDate",header:"返程出发日期"},{key:"returnDepartCity",header:"返程出发城市"},{key:"returnDepartTransportType",header:"返程出发方式"},{key:"returnDepartStation",header:"返程出发场站"},{key:"returnArriveDate",header:"返程抵达日期"},{key:"returnArriveCity",header:"返程抵达城市"},{key:"returnArriveTransportType",header:"返程抵达方式"},{key:"returnArriveStation",header:"返程抵达场站"}];
  const EXPORT_JOURNEY_FORM_COLUMNS = JOURNEY_FORM_COLUMNS.filter(column=>!["arriveTransportType","returnArriveTransportType"].includes(column.key));
  const FIELD_LABELS = {departDate:"出发日期",departCity:"出发城市",departTransportType:"出发出行方式",departStation:"出发场站",arriveDate:"抵达日期",arriveCity:"抵达城市",arriveTransportType:"抵达出行方式",arriveStation:"抵达场站",returnDepartDate:"返程出发日期",returnDepartCity:"返程出发城市",returnDepartTransportType:"返程出发方式",returnDepartStation:"返程出发场站",returnArriveDate:"返程抵达日期",returnArriveCity:"返程抵达城市",returnArriveTransportType:"返程抵达方式",returnArriveStation:"返程抵达场站",outDate:"去程日期",outFrom:"去程出发机场/车站",outTo:"去程抵达机场/车站",outNo:"去程航班/车次",outDeparture:"去程出发时间",outArrival:"去程抵达时间",returnDate:"返程日期",returnFrom:"返程出发机场/车站",returnTo:"返程抵达机场/车站",returnNo:"返程航班/车次",returnDeparture:"返程出发时间",returnArrival:"返程抵达时间",privacyLetterStatus:"隐私沟通函",ticketStatus:"出票状态",businessUnit:"所属 BU",internalPosition:"职位",employeeNo:"员工号",clothingSize:"衣服尺寸"};
  const DOCUMENT_API_BASE = String(window.APP_CONFIG?.documentApiBase || window.location.origin || "https://139.196.97.236").replace(/\/$/, "");
  const DOCUMENT_ADMIN_NAME = "季亮亮";
  const DEFAULT_TOURISM_CITIES = ["北京","天津","承德","秦皇岛","大连","青岛","上海","南京","苏州","杭州","宁波","黄山","厦门","泉州","武汉","宜昌","长沙","张家界","广州","深圳","珠海","桂林","海口","三亚","重庆","成都","乐山","昆明","大理","丽江"];
  async function writeStyledWorkbook(workbook,fileName){
    if(!window.XLSX)throw new Error("Excel 组件尚未加载");
    if(!window.JSZip){XLSX.writeFile(workbook,fileName);return;}
    const bytes=XLSX.write(workbook,{bookType:"xlsx",type:"array"}),zip=await JSZip.loadAsync(bytes),stylesFile=zip.file("xl/styles.xml");
    if(!stylesFile){XLSX.writeFile(workbook,fileName);return;}
    let styles=await stylesFile.async("string");
    const appendStyle=(tag,content)=>{const pattern=new RegExp(`<${tag} count="(\\d+)">`),match=styles.match(pattern);if(!match)throw new Error(`Excel 样式表缺少 ${tag}`);const index=Number(match[1]);styles=styles.replace(pattern,`<${tag} count="${index+1}">`).replace(`</${tag}>`,`${content}</${tag}>`);return index;};
    const fontId=appendStyle("fonts",'<font><sz val="12"/><name val="微软雅黑"/><family val="2"/></font>');
    const borderId=appendStyle("borders",'<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>');
    const styleId=appendStyle("cellXfs",`<xf numFmtId="0" fontId="${fontId}" fillId="0" borderId="${borderId}" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`);
    zip.file("xl/styles.xml",styles);
    const sheetNames=Object.keys(zip.files).filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name));
    await Promise.all(sheetNames.map(async name=>{let xml=await zip.file(name).async("string");xml=xml.replace(/<c\b([^>]*)>/g,(tag,attributes)=>{const next=/\ss="\d+"/.test(attributes)?attributes.replace(/\ss="\d+"/,` s="${styleId}"`):`${attributes} s="${styleId}"`;return`<c${next}>`;});zip.file(name,xml);}));
    const blob=await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=fileName;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const standardTemplate = () => ({ version:1, columns:STANDARD_TEMPLATE_HEADERS.map((header,index) => ({ header, key:STANDARD_TEMPLATE_KEYS[index], required:/\*/.test(header) || ["name","phone","region"].includes(STANDARD_TEMPLATE_KEYS[index]) })) });
  const INTERNAL_BASE_COLUMNS = [
    {header:"No.\n序号",key:"sequence"},{header:"姓名*",key:"name",required:true},
    {header:"所属 BU*",key:"businessUnit",required:true,custom:true},{header:"大区*",key:"region",required:true},
    {header:"职位*",key:"internalPosition",required:true,custom:true},{header:"员工号*",key:"employeeNo",required:true,custom:true},
    {header:"会场",key:"venue"},{header:"性别",key:"sex"},{header:"身份证号 / 护照号",key:"idNumber"},
    {header:"手机号*",key:"phone",required:true},{header:"住宿安排",key:"accommodation"},{header:"备注",key:"remarks"},
  ];
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
      transportStationRules: [
        { station:"大连周水子机场", minutes:120 },
        { station:"大连北站", minutes:90 },
        { station:"大连站", minutes:90 },
        { station:"福州站", minutes:90 },
      ],
      transportGroupMinutes: 30,
      transferCollectionEnabled: false,
      transferCollectionRoles: ["角色嘉宾"],
      travelApprovalRules: { timeEnabled:true, earliestArrival:"2026-09-03T00:00", latestDeparture:"2026-09-13T00:00", tourismEnabled:false, tourismCities:DEFAULT_TOURISM_CITIES, mismatchEnabled:true },
      roomingRules: { singleTitles:["主任医师","副主任医师"], twinSingleKeywords:["标间单住","标间独住"], defaultType:"shared", pairingPriorities:["hospital","city","province","region"], conflictApproval:true },
      fieldConfig: { title:true, hcpId:true, accommodation:true, flight:true, mslContact:true, remarks:true, clothingSize:false, internalRoomingMode:"manual" },
      templateName: "标准32列报名模板",
      templateStoragePath: "",
      templateIsSystemDefault: true,
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
        returnDate: "2026-09-06", returnFrom: "大连", returnTo: "上海", returnNo: "MU5682", returnDeparture: "18:40", returnArrival: "20:35", arriveStation:"大连周水子机场", returnDepartStation:"大连周水子机场",
        approval: "normal", risks: [], createdAt: "2026-08-17T09:20:00+08:00",
        transport: { pickup: { driver: "刘师傅", phone: "139****7712", vehicle: "辽B·72K18 · 别克GL8", time: "2026-09-04 10:25", point: "大连周水子机场 2号门" }, dropoff: { driver: "刘师傅", phone: "139****7712", vehicle: "辽B·72K18 · 别克GL8", time: "2026-09-06 16:10", point: "酒店大堂" } },
      },
      {
        id: "a-102", attendeeType: "HCP", name: "顾明远", city: "杭州", hospital: "浙江示范医学中心", department: "肿瘤内科", title: "副主任医师", venue: "大连会场", sex: "男", idNumber: "330***********516", phone: "13800005202", hcpId: "HCP-26082", accommodation: "Y", flight: "Y", region: "华东大区", mslContact: "宋老师", remarks: "", ownerId: "u-sales-1",
        outDate: "2026-09-04", outFrom: "杭州", outTo: "大连", outNo: "CZ6432", outDeparture: "07:35", outArrival: "09:55",
        returnDate: "2026-09-06", returnFrom: "大连", returnTo: "南京", returnNo: "CA8945", returnDeparture: "19:20", returnArrival: "21:05", arriveStation:"大连周水子机场", returnDepartStation:"大连周水子机场",
        approval: "pending", risks: ["去程出发城市与返程到达城市不一致"], createdAt: "2026-08-17T10:35:00+08:00",
        transport: { pickup: { driver: "待分配", phone: "—", vehicle: "待分配", time: "2026-09-04 10:15", point: "大连周水子机场" }, dropoff: { driver: "待分配", phone: "—", vehicle: "待分配", time: "2026-09-06 16:50", point: "酒店大堂" } },
      },
      {
        id: "a-103", attendeeType: "HCP", name: "梁知夏", city: "厦门", hospital: "海峡示范医院", department: "药学部", title: "主任药师", venue: "福州会场", sex: "女", idNumber: "350***********726", phone: "13800005203", hcpId: "HCP-26083", accommodation: "N", flight: "N", region: "华南大区", mslContact: "方老师", remarks: "本地客户", ownerId: "u-sales-2",
        outDate: "2026-09-11", outFrom: "厦门", outTo: "福州", outNo: "D6208", outDeparture: "08:47", outArrival: "10:18",
        returnDate: "2026-09-12", returnFrom: "福州", returnTo: "厦门", returnNo: "D6235", returnDeparture: "18:22", returnArrival: "19:55", arriveStation:"福州站", returnDepartStation:"福州站",
        approval: "normal", risks: [], createdAt: "2026-08-16T16:12:00+08:00",
        transport: { pickup: { driver: "林师傅", phone: "137****6019", vehicle: "闽A·8F21Q · 大众威然", time: "2026-09-11 10:35", point: "福州南站 北广场" }, dropoff: { driver: "林师傅", phone: "137****6019", vehicle: "闽A·8F21Q · 大众威然", time: "2026-09-12 16:25", point: "会议酒店大堂" } },
      },
      {
        id: "a-104", attendeeType: "HCP", name: "叶书言", city: "苏州", hospital: "苏城示范医院", department: "血液科", title: "主治医师", venue: "福州会场", sex: "男", idNumber: "320***********113", phone: "13800005204", hcpId: "HCP-26084", accommodation: "Y", flight: "Y", region: "华东大区", mslContact: "方老师", remarks: "已出票", ownerId: "u-sales-2",
        outDate: "2026-09-11", outFrom: "苏州", outTo: "福州", outNo: "G1651", outDeparture: "07:58", outArrival: "13:20",
        returnDate: "2026-09-12", returnFrom: "福州", returnTo: "苏州", returnNo: "G1660", returnDeparture: "17:43", returnArrival: "22:55", arriveStation:"福州站", returnDepartStation:"福州站",
        approval: "pending", risks: ["出发城市“苏州”不在预设范围"], createdAt: "2026-08-16T14:50:00+08:00",
        transport: { pickup: { driver: "郑师傅", phone: "136****2210", vehicle: "闽A·33L9P · 别克GL8", time: "2026-09-11 13:40", point: "福州站 南广场" }, dropoff: { driver: "郑师傅", phone: "136****2210", vehicle: "闽A·33L9P · 别克GL8", time: "2026-09-12 15:35", point: "会议酒店大堂" } },
      },
      {
        id: "a-105", attendeeType: "HCP", name: "沈清和", city: "北京", hospital: "京北示范医院", department: "内分泌科", title: "主任医师", venue: "大连会场", sex: "女", idNumber: "110***********842", phone: "13800005205", hcpId: "HCP-26085", accommodation: "Y", flight: "Y", region: "北区", mslContact: "宋老师", remarks: "", ownerId: "u-sales-1",
        outDate: "2026-09-04", outFrom: "北京", outTo: "大连", outNo: "CA8902", outDeparture: "09:10", outArrival: "10:35",
        returnDate: "2026-09-06", returnFrom: "大连", returnTo: "北京", returnNo: "CA8909", returnDeparture: "20:05", returnArrival: "21:30", arriveStation:"大连周水子机场", returnDepartStation:"大连周水子机场",
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
  const selectedVerificationSegments = new Set();
  const disabledVerificationFlightSegments = new Set();
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
  let projectClientAccounts = [];
  let adminAccessGrant = null;
  let adminIdleTimer = null;
  const ADMIN_DEVICE_KEY="lilly-admin-device-id-v1";
  const adminDeviceId=()=>{let value=localStorage.getItem(ADMIN_DEVICE_KEY);if(!value){value=crypto.randomUUID();localStorage.setItem(ADMIN_DEVICE_KEY,value);}return value;};
  function armAdminIdleTimeout(){
    if(!backend||!staffAccess.allowed)return;
    clearTimeout(adminIdleTimer);
    adminIdleTimer=setTimeout(async()=>{await backend.auth.signOut();staffAccess={allowed:false,email:"",displayName:"",systemRole:""};luggageIntegration?.unmount();$("#loginError").textContent="管理员会话已连续 30 分钟无操作，请重新登录";$("#loginDialog").showModal();},30*60*1000);
  }
  ["pointerdown","keydown","scroll","touchstart"].forEach(eventName=>window.addEventListener(eventName,()=>armAdminIdleTimeout(),{passive:true}));

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const normalizePhone = value => String(value || "").replace(/\D/g, "").slice(-11);
  const maskPhone = value => {const phone=normalizePhone(value);return phone.length===11?`${phone.slice(0,3)}****${phone.slice(-4)}`:String(value||"");};
  const maskIdentifier = value => {const text=String(value||"").trim();return text.length>7?`${text.slice(0,3)}${"*".repeat(Math.min(12,text.length-7))}${text.slice(-4)}`:text?`${text.slice(0,1)}***${text.slice(-1)}`:"";};
  function identityDataValidation(attendee={}){
    const fields=new Set(),messages={};
    const add=(field,message)=>{fields.add(field);messages[field]=[...(messages[field]||[]),message];};
    const phone=String(attendee.phone||"").trim();
    if(phone&&!/^\d{11}$/.test(phone))add("phone","手机号必须为11位数字");
    const id=String(attendee.idNumber||"").trim();
    const mainlandCandidate=/^[\dXx]+$/.test(id)&&id!=="待补充";
    if(mainlandCandidate&&!/^\d{17}[\dXx]$/.test(id))add("idNumber","中国大陆身份证必须为18位");
    if(/^\d{17}[\dXx]$/.test(id)){
      const expected=Number(id[16])%2?"男":"女";
      const sex=String(attendee.sex||"").trim();
      const normalizedSex=/^(M|MALE|男)$/i.test(sex)?"男":/^(F|FEMALE|女)$/i.test(sex)?"女":"";
      if(normalizedSex&&normalizedSex!==expected){const message=`身份证性别码对应${expected}，与填写性别不一致`;add("idNumber",message);add("sex",message);}
    }
    return{fields,messages};
  }
  const normalizeVenueLabel = value => String(value || "").trim().replace(/会场$/u, "").trim();
  const dbDate = value => /^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(String(value||"")) ? value : null;
  const dbTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||"")) ? value : null;
  function normalizePrivacyStatus(value) { return value === "paper" ? "paper" : ["electronic","sent","complete"].includes(value) ? "electronic" : "pending"; }
  const currentUser = () => state.users.find(user => user.id === state.currentUserId) || state.users[0];
  const userName = id => state.users.find(user => user.id === id)?.name || "未分配";
  const visibleAttendees = () => currentUser().role === "sales" && staffAccess.systemRole !== "readonly" ? state.attendees.filter(item => item.ownerId === currentUser().id) : state.attendees;
  const activeVisibleAttendees = () => visibleAttendees().filter(item=>item.businessStatus!=="cancelled");
  const canManage = () => isSystemAdmin() || currentUser()?.role === "ops";
  const canEditAttendeeData = () => isSystemAdmin() || currentUser().role === "sales" || (canManage() && !!state.settings.managerEditEnabled);
  // The document service is the authority for archive permissions.  The
  // Journey Desk display name can differ from the archive membership name,
  // so relying on the local label alone incorrectly hid the administrator
  // scenario and final-document options.
  const isSystemAdmin = () => staffAccess.systemRole === "super_admin";
  const isReadOnlyStaff = () => staffAccess.systemRole === "readonly";
  const isDocumentAdmin = () => documentState.user?.role === "admin" || isSystemAdmin();
  const archiveSummary = files => {
    const list=files||[]; const quotation=list.some(file=>file.type==="quotation"); const pendingConfirmation=list.some(file=>file.type==="confirmation"&&file.documentStatus==="pending");
    return { quotation, pendingConfirmation, ready:quotation&&pendingConfirmation };
  };
  const activeArchiveReady = () => !!projectArchiveStates[backendMeetingId]?.ready;
  // 项目建档文件只是可选档案，绝不能作为报名或业务模块的前置条件。
  const activeManagementOpen = () => true;
  const canOpenNewRegistration = () => !!state.settings.registrationOpen && !state.locks.master;
  const isLocked = attendee => state.locks.master || state.locks.rows.includes(attendee.id);
  const isFieldLocked = (attendee,group) => isLocked(attendee)||state.locks.columns.includes(group);
  const currentProject = () => state.projects.find(project => project.id === state.activeProjectId) || state.projects[0] || {};
  const isInternalMeeting = (settings=state.settings) => (settings?.activityType || settings?.meetingType || "external").toString().toLowerCase() === "internal";
  function meetingTemplateColumns(settings=state.settings) {
    const internal=isInternalMeeting(settings);
    let columns=internal ? INTERNAL_BASE_COLUMNS.map(column=>({...column})) : repairRegistrationTemplate(settings.registrationTemplate?.columns?.length?settings.registrationTemplate:standardTemplate()).columns;
    const clothingEnabled=settings.fieldConfig?.clothingSize===true;
    columns=columns.filter(column=>column.key!=="clothingSize");
    if(clothingEnabled)columns.push({header:"衣服尺寸",key:"clothingSize",custom:true});
    return columns;
  }
  function columnsWithJourneyFields(columns){
    const redundant=new Set(["arriveTransportType","returnArriveTransportType"]),ordered=(columns||[]).filter(column=>!redundant.has(column.key)).map(column=>({...column})),keys=()=>ordered.map(column=>column.key);
    EXPORT_JOURNEY_FORM_COLUMNS.forEach((column,canonicalIndex)=>{
      if(keys().includes(column.key))return;
      let insertAt=-1;
      for(let index=canonicalIndex-1;index>=0;index--){const found=keys().indexOf(EXPORT_JOURNEY_FORM_COLUMNS[index].key);if(found>=0){insertAt=found+1;break;}}
      if(insertAt<0){for(let index=canonicalIndex+1;index<EXPORT_JOURNEY_FORM_COLUMNS.length;index++){const found=keys().indexOf(EXPORT_JOURNEY_FORM_COLUMNS[index].key);if(found>=0){insertAt=found;break;}}}
      if(insertAt<0){const businessField=ordered.findIndex(item=>["region","contactName","contactMobile","mslContact","remarks","roomType","clothingSize"].includes(item.key));insertAt=businessField>=0?businessField:ordered.length;}
      ordered.splice(insertAt,0,{...column});
    });
    return ordered;
  }
  const currentEventSlug = () => new URLSearchParams(location.search).get("event") || window.APP_CONFIG?.eventSlug || state.settings.slug || "";
  const projectPublicUrl = (project=currentProject(),hash="portal") => {
    const url = location.protocol==="file:" ? new URL("https://139.196.97.236/meeting/") : new URL(location.href);
    url.searchParams.delete("preview");
    url.searchParams.set("event", project?.slug || state.settings.slug || currentEventSlug());
    url.hash = hash;
    return url.toString();
  };
  const publicProjectUrl = (hash = "portal") => projectPublicUrl(currentProject(),hash);
  function syncActiveProjectQuery(){
    const slug=currentProject().slug||state.settings.slug;if(!slug)return;
    const url=new URL(location.href);if(url.searchParams.get("event")!==slug){url.searchParams.set("event",slug);history.replaceState(null,"",url);}
    publicProjectConfig=null;publicProjectLoadedAt=0;publicAuthSession=null;publicRegistrantAttendees=[];publicEditingAttendeeId=null;
  }
  const projectVisual = project => {
    const icons = ["✦","◈","✚","◎","⌁","◇","✺","⬡"];
    const colors = ["#D52B1E","#7b4f70","#df6555","#b07a2b","#397a73","#a8435b","#526d88","#667080"];
    const seed = [...String(project?.slug || project?.name || "project")].reduce((sum,char)=>sum+char.charCodeAt(0),0);
    return { icon:icons[seed%icons.length], color:colors[seed%colors.length] };
  };

  function loadState() {
    // Production data is authoritative in PostgreSQL.  Never hydrate a full
    // attendee roster from browser storage: shared or lost workstations must
    // not retain names, phone numbers, ID documents or travel details.
    if (window.APP_CONFIG?.mode === "production") {
      localStorage.removeItem(STORAGE_KEY);
      return initialState();
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved?.attendees) { const fresh=initialState();fresh.attendees=fresh.attendees.map(item=>TravelFields.applyLegacy(item));return fresh; }
      const defaults = initialState();
      return { ...defaults, ...saved, attendees:saved.attendees.map(item=>TravelFields.applyLegacy({...item,privacyLetterStatus:normalizePrivacyStatus(item.privacyLetterStatus)})), settings:{...defaults.settings,...saved.settings}, projects:saved.projects?.length ? saved.projects : defaults.projects, activeProjectId:saved.activeProjectId || defaults.activeProjectId };
    } catch { return initialState(); }
  }
  function persistStateLocally() {
    if (window.APP_CONFIG?.mode === "production") {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function saveState() {
    persistStateLocally();
    if (backend) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => syncBackend().catch(error => toast(`云端保存失败：${error.message}`, "error")), 250);
    }
  }
  const journeyBindings=new WeakMap();
  const stationDictionary=()=>Array.isArray(publicProjectConfig?.stationDictionary)&&publicProjectConfig.stationDictionary.length?publicProjectConfig.stationDictionary:loadSystemPreferences().stationDictionary||[];
  async function fetchAllStationRows(){const data=[];for(let start=0;;start+=1000){const result=await backend.from("station_dict").select("city_name,transport_type,station_name,station_short_name").order("city_name").order("transport_type").order("station_name").range(start,start+999);if(result.error)return result;data.push(...(result.data||[]));if((result.data||[]).length<1000)break;}return{data,error:null};}
  async function loadJourneyStations(city,transportType){
    const cleanedCity=TravelFields.normalizeCity(city),type=TravelFields.normalizeType(transportType);
    if(!cleanedCity||!["PLANE","HIGH_SPEED_RAIL"].includes(type))return[];
    if(window.APP_CONFIG?.mode==="production"&&window.APP_CONFIG?.supabaseUrl){
      const endpoint=new URL(`${window.APP_CONFIG.supabaseUrl}/functions/v1/public-trip-query`);endpoint.searchParams.set("action","station-list");endpoint.searchParams.set("cityName",city);endpoint.searchParams.set("transportType",type);
      const response=await fetch(endpoint,{headers:{"apikey":window.APP_CONFIG.supabaseAnonKey}});
      const payload=await response.json();if(response.ok&&payload.success&&Array.isArray(payload.data))return payload.data.map(item=>({city:cleanedCity,type,name:item.station_name,shortName:item.station_short_name}));
    }
    return TravelFields.stationList(stationDictionary(),cleanedCity,type);
  }
  const EXTRA_JOURNEY_FIELDS=["departDate","departCity","transportType","departStation","arriveDate","arriveCity","arriveStation","number","departure","arrival"];
  const extraJourneyId=()=>crypto.randomUUID?.()||`segment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  function normalizedExtraJourneys(value){
    if(!Array.isArray(value))return[];
    return value.slice(0,18).map((item,index)=>({id:String(item?.id||extraJourneyId()),direction:item?.direction==="return"?"return":"outbound",order:Number(item?.order)||index+2,...Object.fromEntries(EXTRA_JOURNEY_FIELDS.map(key=>[key,String(item?.[key]||"").trim()]))}));
  }
  function collectExtraJourneys(form){
    return [...form.querySelectorAll("[data-extra-journey-card]")].map((card,index)=>{
      const item={id:card.dataset.extraJourneyCard,direction:card.dataset.direction,order:index+2};
      EXTRA_JOURNEY_FIELDS.forEach(key=>item[key]=String(card.querySelector(`[data-extra-field="${key}"]`)?.value||"").trim());
      item.transportType=TravelFields.normalizeType(item.transportType,item.number);
      if(item.transportType==="LOCAL_ATTEND")item.departStation=item.arriveStation="";
      else {item.departStation=TravelFields.officialStation(item.departStation,item.transportType,stationDictionary());item.arriveStation=TravelFields.officialStation(item.arriveStation,item.transportType,stationDictionary());}
      return item;
    });
  }
  function extraJourneyCard(item,index){
    const prefix=item.direction==="return"?"返程":"去程",types=Object.entries(TravelFields.TYPES).map(([value,label])=>`<option value="${value}" ${item.transportType===value?"selected":""}>${label}</option>`).join("");
    const field=(key,label,type="text")=>`<label>${label}<input data-extra-field="${key}" type="${type}" value="${escapeHtml(item[key]||"")}" required /></label>`;
    return `<article class="extra-journey-card" data-extra-journey-card="${escapeHtml(item.id)}" data-direction="${item.direction}"><header><div><strong>${prefix}第 ${index+2} 段</strong><small>本段将单独参加真实性核验</small></div><button class="text-button danger" data-remove-journey="${escapeHtml(item.id)}" type="button">删除本段</button></header><div class="public-field-grid extra-journey-grid">${field("departDate","出发日期","date")}${field("departCity","出发城市")}<label>出行方式<select data-extra-field="transportType" required><option value="">请选择</option>${types}</select></label>${field("departStation","出发场站")}${field("arriveDate","抵达日期","date")}${field("arriveCity","抵达城市")}${field("arriveStation","抵达场站")}${field("number","航班 / 车次号")}${field("departure","出发时间","time")}${field("arrival","到达时间","time")}</div><datalist data-extra-stations="depart"></datalist><datalist data-extra-stations="arrive"></datalist></article>`;
  }
  function initMultiJourneyForm(form,attendee={}){
    if(!form)return;
    form._extraJourneys=normalizedExtraJourneys(attendee.customFields?._journeySegments||attendee.journeySegments||[]);
    const render=()=>{
      for(const direction of ["outbound","return"]){
        const list=form.querySelector(`[data-extra-journeys="${direction}"]`);if(!list)continue;
        const items=form._extraJourneys.filter(item=>item.direction===direction);list.innerHTML=items.map(extraJourneyCard).join("");
      }
      form.querySelectorAll("[data-remove-journey]").forEach(button=>button.onclick=()=>{form._extraJourneys=collectExtraJourneys(form).filter(item=>item.id!==button.dataset.removeJourney);render();});
      form.querySelectorAll("[data-extra-journey-card]").forEach(card=>{
        const mode=card.querySelector('[data-extra-field="transportType"]'),departCity=card.querySelector('[data-extra-field="departCity"]'),arriveCity=card.querySelector('[data-extra-field="arriveCity"]');
        const refresh=async(side,clear=false)=>{const station=card.querySelector(`[data-extra-field="${side}Station"]`),city=card.querySelector(`[data-extra-field="${side}City"]`);if(clear)station.value="";const local=mode.value==="LOCAL_ATTEND";station.disabled=local;if(local){station.required=false;station.value="";return;}station.required=true;const rows=await loadJourneyStations(city.value,mode.value);const datalist=card.querySelector(`[data-extra-stations="${side}"]`),listId=`stations-${card.dataset.extraJourneyCard}-${side}`;datalist.id=listId;datalist.innerHTML=rows.map(row=>`<option value="${escapeHtml(row.shortName||TravelFields.displayStation(row.name,row.type))}"></option>`).join("");station.setAttribute("list",listId);station.placeholder=rows.length?"可输入关键词筛选场站":"未查询到对应场站，请手动录入";};
        mode.onchange=()=>{refresh("depart",true);refresh("arrive",true);};departCity.onchange=()=>refresh("depart",true);arriveCity.onchange=()=>refresh("arrive",true);refresh("depart");refresh("arrive");
      });
    };
    form.querySelectorAll("[data-add-journey]").forEach(button=>button.onclick=()=>{form._extraJourneys=[...collectExtraJourneys(form),{id:extraJourneyId(),direction:button.dataset.addJourney,order:99,...Object.fromEntries(EXTRA_JOURNEY_FIELDS.map(key=>[key,""]))}];render();});
    render();
  }
  function bindJourneyForm(form,attendee={}){
    journeyBindings.get(form)?.();
    const values=TravelFields.hydrate(attendee);
    Object.entries(values).forEach(([key,value])=>{if(form.elements[key])form.elements[key].value=value||"";});
    // Station controls acquire their form names after dictionary rendering.
    for(const side of ["depart","arrive","returnDepart","returnArrive"]){
      const select=form.querySelector(`[data-station-select="${side}"]`),input=form.querySelector(`[data-station-input="${side}"]`);
      if(select)select.value=values[`${side}Station`]||"";if(input)input.value=values[`${side}Station`]||"";
    }
    for(const [depart,arrive] of [["departTransportType","arriveTransportType"],["returnDepartTransportType","returnArriveTransportType"]]){
      if(!form.elements[depart]||!form.elements[arrive])continue;
      const sync=()=>{form.elements[arrive].value=form.elements[depart].value;form.elements[arrive].dispatchEvent(new Event("change",{bubbles:true}));};
      if(!form.elements[arrive].value)form.elements[arrive].value=form.elements[depart].value;form.elements[depart].addEventListener("change",sync);
    }
    journeyBindings.set(form,TravelFields.bindForm(form,{customDictionary:stationDictionary(),preserve:true,loadStations:loadJourneyStations}));
    initMultiJourneyForm(form,attendee);
  }
  function toast(message, type = "success") {
    const node = document.createElement("div"); node.className = `toast ${type === "error" ? "error" : ""}`; node.textContent = message;
    $("#toastRegion").append(node); setTimeout(() => node.remove(), 3200);
  }
  function addNotification(type, text,meta={}) {
    state.notifications.unshift({ id:`n-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,type,text,time:new Date().toISOString(),read:!!meta.read,auditOnly:meta.publicSource?false:meta.auditOnly!==false,publicSource:!!meta.publicSource,attendeeName:meta.attendeeName||"",actorName:meta.actorName||currentUser()?.name||"系统",changes:meta.changes||[] });
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
    "PEK T2":"北京首都机场T2航站楼","首都机场T2":"北京首都机场T2航站楼","北京首都T2":"北京首都机场T2航站楼",
    "PEK T3":"北京首都机场T3航站楼","首都机场T3":"北京首都机场T3航站楼","北京首都T3":"北京首都机场T3航站楼",
    "PKX":"北京大兴机场","大兴机场":"北京大兴机场","北京大兴机场":"北京大兴机场",
    "北京南":"北京南站","北京西":"北京西站","北京朝阳":"北京朝阳站","北京丰台":"北京丰台站",
    "上海虹桥":"上海虹桥站","上海南":"上海南站","福州南":"福州南站","大连北":"大连北站",
  }));
  const normalizeTerminal = (value,number="") => {
    const raw=String(value||"").trim();
    if(isTrainNumber(number)){const station=TERMINAL_ALIASES.get(raw)||raw;return station&&!/站$/u.test(station)?`${station.replace(/(?:火车|高铁)站?$/u,"")}站`:station;}
    return TERMINAL_ALIASES.get(raw)||raw;
  };
  const isTrainNumber = value => /^(G|D|C|S|Z|T|K)\d+/i.test(String(value||"").trim());
  const VERIFICATION_MULTI_AIRPORTS=["北京","上海","成都"];
  const VERIFICATION_AIRPORT_CITIES=["南通","银川","广州","深圳","天津","重庆","南京","杭州","宁波","温州","福州","厦门","泉州","青岛","济南","大连","沈阳","长春","哈尔滨","武汉","长沙","郑州","西安","太原","石家庄","合肥","南昌","昆明","贵阳","南宁","海口","三亚","兰州","乌鲁木齐","呼和浩特","珠海","无锡","常州","烟台","威海","桂林","丽江","西宁","拉萨","宜昌","洛阳","扬州","徐州"];
  function verificationTerminalLabel(value,number,mode="") {
    const raw=String(value||"").trim();if(!raw)return"—";
    const train=mode?mode==="train":isTrainNumber(number);
    if(train){const station=TERMINAL_ALIASES.get(raw)||raw;return /站$/u.test(station)?station:`${station.replace(/(?:火车|高铁)站?$/u,"")}站`;}
    const terminal=raw.match(/(?:\bT\s*([1-9]\d*)\b|([1-9]\d*)\s*号?航站楼)/i);const terminalLabel=terminal?` T${terminal[1]||terminal[2]}`:"";
    let airport=raw.replace(/\bT\s*[1-9]\d*\b/ig,"").replace(/[1-9]\d*\s*号?航站楼/ug,"").replace(/航站楼|国际机场|机场/ug,"").trim();
    if(/^北京/u.test(airport)){airport=airport.includes("大兴")?"北京大兴":airport.includes("首都")?"北京首都":airport;return`${airport}${terminalLabel}`;}
    const multiCity=VERIFICATION_MULTI_AIRPORTS.find(city=>airport.startsWith(city));
    if(multiCity)return`${airport}${terminalLabel}`;
    const city=VERIFICATION_AIRPORT_CITIES.find(item=>airport.startsWith(item));
    return`${city||airport}${terminalLabel}`;
  }
  if(new URLSearchParams(location.search).get("preview")==="terminal")Object.defineProperty(window,"__verificationTerminalLabel",{value:verificationTerminalLabel,configurable:true});
  const isPreciseTerminal = (value,number) => {
    const text=normalizeTerminal(value,number); if(!text)return false;
    if(isTrainNumber(number))return /站$/.test(text);
    if(/(北京首都|上海浦东|上海虹桥|广州白云|成都双流|重庆江北|深圳宝安).*(机场)/.test(text)&&!/(T\d|航站楼)/i.test(text))return false;
    return /(机场|航站楼)/.test(text);
  };
  const locationCity = value => state.settings.allowedCities.find(city=>String(value||"").includes(city)) || String(value||"").replace(/(国际)?机场.*|[A-Z]?\d航站楼.*|站$/g,"").trim();

  function evaluateSegmentRisks(data) {
    if(isInternalMeeting())return {outbound:[],return:[]};
    const rules=state.settings.travelApprovalRules||{};
    const result={outbound:[],return:[]};
    const timestamp=(date,time)=>date&&time?new Date(`${date}T${time}`).getTime():NaN;
    const outside=(value,start,end)=>Number.isFinite(value)&&((start&&value<new Date(start).getTime())||(end&&value>new Date(end).getTime()));
    if(rules.timeEnabled){
      const arrival=timestamp(data.outDate,data.outArrival);const departure=timestamp(data.returnDate,data.returnDeparture);
      if(outside(arrival,rules.earliestArrival||rules.arrivalStart,""))result.outbound.push(`抵达时间 ${data.outDate} ${data.outArrival} 早于会议允许最早抵达时间`);
      if(outside(departure,"",rules.latestDeparture||rules.returnEnd))result.return.push(`返程时间 ${data.returnDate} ${data.returnDeparture} 晚于会议允许最晚撤离时间`);
    }
    if(rules.tourismEnabled&&data.outFrom&&(rules.tourismCities||[]).some(city=>String(data.outFrom).includes(city)))result.outbound.push(`出发城市“${locationCity(data.outFrom)}”属于项目旅游城市审批清单`);
    if((rules.mismatchEnabled??state.settings.mismatchRule)&&data.outFrom&&data.returnTo&&locationCity(data.outFrom)!==locationCity(data.returnTo))result.return.push("去程出发城市与返程到达城市不一致");
    return {outbound:[...new Set(result.outbound)],return:[...new Set(result.return)]};
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

  async function registerStaffSession(){
    const {data,error}=await backend.rpc("register_staff_session",{p_device_id:adminDeviceId(),p_user_agent:navigator.userAgent});
    if(error)throw new Error(error.message||"登录会话登记失败");
    const row=Array.isArray(data)?data[0]:data;
    if(!row?.allowed)throw new Error("当前登录会话未通过安全校验");
    if(Number(row.revoked_sessions)>0)toast(`已超出 ${row.max_devices} 台在线设备，最早的登录会话已失效`);
    return row;
  }

  async function validateAdminAccessLink(){
    const token=new URL(location.href).searchParams.get("admin_access");
    if(!token)return;
    const status=$("#adminAccessLinkStatus");
    const {data,error}=await backend.rpc("validate_admin_access_link",{p_token:token});
    const row=Array.isArray(data)?data[0]:data;
    status.classList.remove("is-hidden");
    if(error||!row?.valid){status.textContent="临时登录链接已过期或无效，请联系超级管理员重新生成。";status.classList.add("login-error");return;}
    adminAccessGrant=row;status.textContent=`临时登录链接有效至 ${new Date(row.expires_at).toLocaleString("zh-CN",{hour12:false})}`;
    if(row.target_email){$("#loginForm").elements.email.value=row.target_email;$("#loginForm").elements.email.readOnly=true;}
  }

  async function loadStaffDirectory() {
    staffDirectory = [];
    if (!backend || !backendMeetingId || !isSystemAdmin()) return;
    const { data, error } = await backend.rpc("list_system_staff", { p_meeting_id: backendMeetingId });
    if (error) throw new Error(`会务负责人账号读取失败：${error.message}`);
    staffDirectory = Array.isArray(data) ? data : [];
  }

  async function loadProjectClientAccounts(){
    projectClientAccounts=[];if(!backend||!backendMeetingId||!isSystemAdmin())return;
    const{data,error}=await backend.rpc("list_project_client_accounts",{p_meeting_id:backendMeetingId});
    if(error)throw new Error(`客户会议负责人账号读取失败：${error.message}`);projectClientAccounts=Array.isArray(data)?data:[];
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
      const isReadonly = staff.system_role === "readonly";
      const enabled = !!staff.project_enabled;
      const accountState = staff.account_created ? "登录账号已创建" : "尚未创建登录账号";
      return `<div class="system-staff-row">
        <span class="system-staff-avatar ${isAdmin ? "admin" : ""}">${escapeHtml((staff.display_name || "人").slice(0,1))}</span>
        <div class="system-staff-main"><strong>${escapeHtml(staff.display_name)}</strong><small>${escapeHtml(staff.email)}</small></div>
        <div class="system-staff-badges"><span class="status ${staff.account_created ? "status-normal" : "status-locked"}">${accountState}</span>${!staff.account_created?`<button class="button button-secondary" type="button" data-create-staff-account="${escapeHtml(staff.email)}">创建登录账号</button>`:`<button class="button button-secondary" type="button" disabled title="该邮箱的登录账号已经存在">创建登录账号（已完成）</button>`}${isAdmin ? `<span class="status status-ok">超级管理员 · 可兼任会务负责人</span>` : `<label>系统角色<select data-system-staff-role="${escapeHtml(staff.email)}"><option value="ops" ${isReadonly?"":"selected"}>会务负责人</option><option value="readonly" ${isReadonly?"selected":""}>只读查看</option></select></label>`}</div>
        <label class="permission-switch system-staff-switch"><span><strong>${enabled ? (isAdmin ? "兼任当前项目会务负责人" : "已授权当前项目") : (isAdmin ? "未兼任当前项目会务负责人" : "未授权当前项目")}</strong><small>${staff.account_created ? (isAdmin ? "不影响超级管理员的全局最高权限" : "可随时开放或回收") : (enabled ? "已预先委任，登录账号创建后自动生效" : "可先委任，登录账号创建后自动生效")}</small></span><span class="switch"><input type="checkbox" data-system-staff-email="${escapeHtml(staff.email)}" ${enabled ? "checked" : ""}/><span></span></span></label>
      </div>`;
    }).join("") || `<div class="empty-state">暂无可分配的会务负责人账号</div>`;
    $$('[data-system-staff-email]', list).forEach(input => input.addEventListener("change", () => toggleProjectStaff(input.dataset.systemStaffEmail, input.checked, input)));
    $$('[data-system-staff-role]', list).forEach(select=>select.addEventListener("change",()=>setSystemStaffRole(select.dataset.systemStaffRole,select.value,select)));
    $$('[data-create-staff-account]',list).forEach(button=>button.addEventListener("click",()=>openStaffAccountDialog(button.dataset.createStaffAccount)));
  }

  function renderProjectClientAccounts(){
    const panel=$("#clientAccountPanel"),list=$("#clientAccountList");if(!panel||!list)return;
    const visible=!!backendMeetingId&&isSystemAdmin();panel.classList.toggle("is-hidden",!visible);if(!visible){list.innerHTML="";return;}
    list.innerHTML=projectClientAccounts.length?projectClientAccounts.map(account=>`<div class="system-staff-row"><span class="system-staff-avatar">${escapeHtml((account.display_name||"客").slice(0,1))}</span><div class="system-staff-main"><strong>${escapeHtml(account.display_name)}</strong><small>${escapeHtml(account.email)}</small></div><div class="system-staff-badges"><span class="status ${account.active?"status-normal":"status-locked"}">${account.active?"当前项目已授权":"已停用"}</span><span class="status status-ok">客户会议负责人</span></div><button class="button button-secondary" type="button" data-revoke-client-account="${escapeHtml(account.email)}" ${account.active?"":"disabled"}>移出当前项目</button></div>`).join(""):`<div class="empty-state">当前项目尚未创建客户会议负责人账号</div>`;
    $$('[data-revoke-client-account]',list).forEach(button=>button.onclick=()=>revokeProjectClientAccount(button.dataset.revokeClientAccount,button));
  }

  function openClientAccountDialog(){if(!backendMeetingId||!isSystemAdmin())return deny();const form=$("#clientAccountForm");form.reset();$("#clientAccountProjectName").textContent=`仅授权访问：${state.settings.eventName||"当前会议"}`;$("#clientAccountError").textContent="";$("#clientAccountDialog").showModal();}

  async function createClientAccount(event){event.preventDefault();const form=event.currentTarget,password=form.elements.password.value,confirmation=form.elements.confirmPassword.value;if(password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!(/[^A-Za-z0-9]/.test(password)))return $("#clientAccountError").textContent="临时密码至少12位，并包含大小写字母、数字和特殊字符";if(password!==confirmation)return $("#clientAccountError").textContent="两次输入的临时密码不一致";const button=form.querySelector('button[type="submit"]');button.disabled=true;try{const{data:{session}}=await backend.auth.getSession();if(!session)throw new Error("登录会话已过期");const response=await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/staff-account-admin`,{method:"POST",headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey,"Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({accountType:"client",email:form.elements.email.value.trim().toLowerCase(),displayName:form.elements.displayName.value.trim(),password,meetingId:backendMeetingId})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"客户账号创建失败");form.reset();$("#clientAccountDialog").close();await loadProjectClientAccounts();renderProjectClientAccounts();toast("客户会议负责人账号已创建，仅授权当前项目");}catch(error){$("#clientAccountError").textContent=error.message||"客户账号创建失败";}finally{button.disabled=false;}}

  async function revokeProjectClientAccount(email,button){if(!confirm(`确认将 ${email} 移出当前项目？账号在其他项目的权限不受影响。`))return;button.disabled=true;const{error}=await backend.rpc("set_project_client_account_active",{p_meeting_id:backendMeetingId,p_email:email,p_active:false});if(error){button.disabled=false;return toast(`移除失败：${error.message}`,"error");}await loadProjectClientAccounts();renderProjectClientAccounts();toast("客户会议负责人已移出当前项目");}

  function signedInAccessLabel(){return isSystemAdmin()?"超级管理员":isReadOnlyStaff()?"只读查看":staffAccess.systemRole==="client"?"客户会议负责人":"会务负责人";}

  function openStaffAccountDialog(email){
    if(!isSystemAdmin())return deny();
    const staff=staffDirectory.find(item=>item.email===email);if(!staff)return;
    const form=$("#staffAccountForm");form.reset();form.elements.email.value=staff.email;form.elements.displayName.value=staff.display_name;
    form.elements.assignProject.checked=!!backendMeetingId;$("#staffAccountProjectName").textContent=state.settings.eventName||"当前项目";$("#staffAccountError").textContent="";$("#staffAccountDialog").showModal();
  }

  async function createStaffAccount(event){
    event.preventDefault();if(!backend||!backendMeetingId||!isSystemAdmin())return deny();
    const form=event.currentTarget,password=form.elements.password.value,confirmation=form.elements.confirmPassword.value;
    if(password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!(/[^A-Za-z0-9]/.test(password)))return $("#staffAccountError").textContent="临时密码至少12位，并包含大小写字母、数字和特殊字符";
    if(password!==confirmation)return $("#staffAccountError").textContent="两次输入的临时密码不一致";
    const button=form.querySelector('button[type="submit"]');button.disabled=true;
    try{
      const {data:{session}}=await backend.auth.getSession();if(!session)throw new Error("登录会话已过期");
      const response=await fetch(`${window.APP_CONFIG.supabaseUrl}/functions/v1/staff-account-admin`,{method:"POST",headers:{"Content-Type":"application/json","apikey":window.APP_CONFIG.supabaseAnonKey,"Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({accountType:"staff",email:form.elements.email.value,displayName:form.elements.displayName.value,password,meetingId:backendMeetingId,assignProject:form.elements.assignProject.checked})});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||"账号创建失败");
      form.reset();$("#staffAccountDialog").close();await loadStaffDirectory();renderSystemStaffDirectory();renderSystemSettings();toast("登录账号已创建并完成项目权限设置");
    }catch(error){$("#staffAccountError").textContent=error.message||"账号创建失败";}finally{button.disabled=false;}
  }

  async function requirePasswordChange(){
    if(!backend)return;const{data}=await backend.auth.getUser();if(data.user?.user_metadata?.must_change_password){$("#changePasswordError").textContent="";$("#changePasswordDialog").showModal();}
  }

  async function changeOwnPassword(event){
    event.preventDefault();const form=event.currentTarget,password=form.elements.password.value,confirmation=form.elements.confirmPassword.value;
    if(password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!(/[^A-Za-z0-9]/.test(password)))return $("#changePasswordError").textContent="新密码至少12位，并包含大小写字母、数字和特殊字符";
    if(password!==confirmation)return $("#changePasswordError").textContent="两次输入的新密码不一致";
    const button=form.querySelector('button[type="submit"]');button.disabled=true;const{error}=await backend.auth.updateUser({password,data:{must_change_password:false}});button.disabled=false;
    if(error)return $("#changePasswordError").textContent=error.message||"密码更新失败";form.reset();$("#changePasswordDialog").close();toast("登录密码已更新");
  }

  async function setSystemStaffRole(email,role,select){if(!backend||!isSystemAdmin())return deny();select.disabled=true;try{const{error}=await backend.rpc("set_system_staff_role",{p_email:email,p_role:role});if(error)throw error;await loadStaffDirectory();renderSystemStaffDirectory();renderSystemSettings();toast("系统角色已更新");}catch(error){toast(`角色更新失败：${error.message}`,"error");await loadStaffDirectory();renderSystemStaffDirectory();}}

  async function toggleProjectStaff(email, enabled, input) {
    if (!backend || !backendMeetingId || !isSystemAdmin()) return deny();
    input.disabled = true;
    try {
      const { error } = await backend.rpc("set_project_staff_member", { p_meeting_id: backendMeetingId, p_email: email, p_enabled: enabled });
      if (error) throw error;
      await loadStaffDirectory();
      renderSystemStaffDirectory();
      toast(enabled ? "已委任为当前项目会务负责人" : "已取消当前项目会务负责人委任");
    } catch (error) {
      input.checked = !enabled;
      input.disabled = false;
      toast(`账号权限更新失败：${error.message}`, "error");
    }
  }

  let luggageIntegration;
  let offlineLuggageSession = null;
  function luggageContext() {
    return { eventId:state.activeProjectId, eventName:state.settings.eventName, userId:state.currentUserId, operator:currentUser()?.name || '', enabled:!!state.settings.luggageEnabled, used:!!state.settings.luggageUsed, configured:!!state.settings.luggageConfigured, offlineUntil:offlineLuggageSession?.expiresAt || null };
  }
  async function init() {
    luggageIntegration = window.createJourneyLuggage({
      current:luggageContext, canManage, isProduction:()=>window.APP_CONFIG?.mode === 'production', backend:()=>backend,
      authenticated:()=>staffAccess.allowed === true && !!backendMeetingId, attendees:()=>state.attendees, toast,
      setEnabled(enabled) { state.settings.luggageEnabled=enabled; state.settings.luggageUsed=state.settings.luggageUsed||enabled; const project=currentProject(); if(project){project.luggageEnabled=enabled;project.luggageUsed=state.settings.luggageUsed;} persistStateLocally(); renderAll(); },
      markUsed() {state.settings.luggageUsed=true;const project=currentProject();if(project)project.luggageUsed=true;},
    });
    bindLogin();
    applySystemAppearance();
    if (navigator.onLine === false && state.settings.luggageEnabled) {
      offlineLuggageSession = await luggageIntegration.resume(state.currentUserId);
      if (offlineLuggageSession) {
        const saved=offlineLuggageSession;
        state={...initialState(),currentUserId:saved.userId,activeProjectId:saved.eventId,
          users:[{id:saved.userId,name:saved.operator,role:'ops',label:'现场离线操作员'}],
          projects:[{id:saved.eventId,name:saved.eventName,slug:saved.eventId,registrationOpen:true,luggageEnabled:true,luggageUsed:true}],
          attendees:[],notifications:[],settings:{...initialState().settings,eventName:saved.eventName,luggageEnabled:true,luggageUsed:true,luggageConfigured:true}};
        backendMeetingId=saved.eventId;staffAccess={allowed:true,systemRole:'',displayName:saved.operator};
        history.replaceState(null,'','#luggage');
      }
    }
    const cleanUrl=new URL(location.href);if(cleanUrl.searchParams.has("preview")){cleanUrl.searchParams.delete("preview");history.replaceState(null,"",cleanUrl.toString());}
    const config = window.APP_CONFIG || {};
    if (config.mode === "production" && config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
      backend = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      backend.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") { luggageIntegration?.clearAccess(); staffAccess.allowed=false; luggageIntegration?.unmount(); } });
      await validateAdminAccessLink().catch(()=>{});
      const { data } = offlineLuggageSession ? {data:{session:null}} : await backend.auth.getSession();
      if (data.session) {
        try{await requireManagementMfa();await registerStaffSession();await loadStaffAccess();await loadBackendState();armAdminIdleTimeout();await requirePasswordChange();}
        catch(error){await backend.auth.signOut();staffAccess={allowed:false,email:"",displayName:"",systemRole:""};$("#loginError").textContent=error.message;$("#loginDialog").showModal();}
      }
      else if (!offlineLuggageSession && !["portal", "lookup", "register", "manage"].includes((location.hash || "#dashboard").slice(1).split("?")[0])) $("#loginDialog").showModal();
    }
    populateUsers(); populateProjects(); bindNavigation(); bindForms(); bindControls(); route(); renderAll(); maybeAutoBackup();
    window.setInterval(renderGreeting,60000);
    window.setInterval(async()=>{if(backend&&staffAccess.allowed){try{await registerStaffSession();}catch{await backend.auth.signOut();staffAccess={allowed:false,email:"",displayName:"",systemRole:""};$("#loginError").textContent="登录会话已在其他设备失效，请重新登录";$("#loginDialog").showModal();}}},5*60*1000);
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
    form.elements.sourceId.value=copying?source?.id||"":""; form.elements.slug.value=editing?source?.slug||"":copying?`${source?.slug||"meeting"}-copy-${String(Date.now()).slice(-4)}`:"";
    $("#projectDialogTitle").textContent=editing?"编辑会议":"新建会议"; $("#projectDialogHint").textContent=editing?"修改会议基础资料，建档文件和参会数据保持不变":"创建后进入会议详情，配置报名、审批、分房和项目建档文件";
    $("#projectCopyField").classList.toggle("is-hidden",editing); $("#projectSubmitButton").textContent=editing?"保存会议修改":"创建会议并进入详情"; $("#projectFormError").textContent=""; updateProjectIdentifierLabel(); $("#projectDialog").showModal();
  }

  async function switchProject(projectId) {
    if (!projectId || projectId === state.activeProjectId) return;
    if (!luggageIntegration.canLeave()) { populateProjects(); return toast("行李正在保存，请稍后切换会议", "error"); }
    luggageIntegration.unmount();
    try {
      if (backend && backendMeetingId) await loadBackendState(projectId);
      else {
        const project = state.projects.find(item => item.id === projectId);
        if (!project) return;
        state.activeProjectId = projectId;
        state.settings = { ...state.settings, luggageEnabled:!!project.luggageEnabled, luggageUsed:!!project.luggageUsed, eventName:project.name, slug:project.slug, activityType:project.activityType||"external", identifier:project.identifier||project.slug, activityOwner:project.activityOwner||"", activityDate:project.activityDate||project.startDate||"", clientName:project.clientName||"", startDate:project.startDate||"", endDate:project.endDate||"", brandColor:project.brandColor||"#5267d9" };
        persistStateLocally();
      }
      syncActiveProjectQuery();populateUsers(); populateProjects(); renderAll(); location.hash = "dashboard"; toast(`已切换至${state.settings.eventName}`);
    } catch (error) { toast(`项目切换失败：${error.message}`, "error"); populateProjects(); }
  }

  async function createProject(event) {
    event.preventDefault();
    const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
    const editId=String(data.editId||""); const name = String(data.name||"").trim(); const activityType = data.activityType === "internal" ? "internal" : "external"; const identifier = String(data.identifier||"").trim(); const activityOwner = String(data.activityOwner||"").trim(); const activityDate = String(data.activityDate||"");
    const existing=state.projects.find(project=>project.id===editId); const internalSlug=String(data.slug||existing?.slug||`meeting-${identifier.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||Date.now()}-${String(Date.now()).slice(-5)}`).trim().toLowerCase();
    const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(internalSlug)?internalSlug:`meeting-${Date.now()}`;
    $("#projectFormError").textContent = "";
    if (!name || !identifier || !activityOwner || !/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) return $("#projectFormError").textContent = "请完整填写会议名称、会议编码、活动负责人和活动日期";
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
        state.activeProjectId = projectId; state.settings = { ...initialState().settings, ...(source ? state.settings : {}), eventName:name, slug, activityType, identifier, activityOwner, activityDate, luggageEnabled:false, luggageUsed:false };
        state.attendees = []; state.notifications = []; state.locks = {master:false,columns:[],rows:[]}; persistStateLocally();
      }
      syncActiveProjectQuery();
      if (backend) await syncDocumentProject().catch(error => toast(`项目建档初始化失败：${error.message}`, "error"));
      await loadProjectArchiveStates(); form.reset(); $("#projectDialog").close(); populateUsers(); populateProjects(); renderAll(); location.hash = editId?"projects":"settings"; toast(editId?"项目资料已更新":"项目已创建，可继续配置会议或上传可选建档文件");
    } catch (error) { $("#projectFormError").textContent = error.message.includes("duplicate") ? "项目编号已存在，请更换" : error.message; }
  }

  function bindLogin() {
    $("#staffAccountForm").addEventListener("submit",createStaffAccount);
    $("#clientAccountForm").addEventListener("submit",createClientAccount);
    $("#openClientAccountDialog").addEventListener("click",openClientAccountDialog);
    $("#changePasswordForm").addEventListener("submit",changeOwnPassword);
    $("#changePasswordDialog").addEventListener("cancel",event=>event.preventDefault());
    $("#loginForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (!backend) return;
      const form = event.currentTarget;
      const button=form.querySelector('button[type="submit"]');button.disabled=true;
      const email=String(form.elements.email.value||"").trim().toLowerCase();
      const { error } = await backend.auth.signInWithPassword({ email, password: form.elements.password.value });
      if (error) { $("#loginError").textContent = "邮箱或密码不正确"; button.disabled=false; return; }
      try{$("#loginError").textContent="";await requireManagementMfa();await registerStaffSession();await loadStaffAccess();await loadBackendState();armAdminIdleTimeout();populateUsers();populateProjects();renderAll();$("#loginDialog").close();location.hash=state.activeProjectId?"dashboard":"projects";route();await requirePasswordChange();toast(state.activeProjectId?`登录成功 · ${signedInAccessLabel()}`:"登录成功，请先新建项目");}
      catch(accessError){await backend.auth.signOut();staffAccess={allowed:false,email:"",displayName:"",systemRole:""};$("#loginError").textContent=accessError.message||"当前邮箱未开放管理系统权限";}
      finally{button.disabled=false;}
    });
  }

  async function requireManagementMfa() {
    const assurance=await backend.auth.mfa.getAuthenticatorAssuranceLevel();
    if(assurance.error)throw assurance.error;
    if(assurance.data?.currentLevel==="aal2")return;
    const listed=await backend.auth.mfa.listFactors();
    if(listed.error)throw listed.error;
    let factor=listed.data?.totp?.[0]||null;
    let enrollment=null;
    if(!factor){
      for(const stale of listed.data?.all||[])if(stale.factor_type==="totp"&&stale.status!=="verified")await backend.auth.mfa.unenroll({factorId:stale.id});
      const enrolled=await backend.auth.mfa.enroll({factorType:"totp",friendlyName:"礼来会议管理平台"});
      if(enrolled.error)throw enrolled.error;
      enrollment=enrolled.data;factor={id:enrollment.id};
    }
    const dialog=$("#mfaDialog"),form=$("#mfaForm"),enrollmentPanel=$("#mfaEnrollment");
    $("#mfaError").textContent="";form.reset();
    enrollmentPanel.classList.toggle("is-hidden",!enrollment);
    $("#mfaDialogHint").textContent=enrollment?"首次登录需要先绑定身份验证器":"请输入身份验证器中的动态验证码";
    if(enrollment){$("#mfaQrCode").src=enrollment.totp.qr_code;$("#mfaSecret").value=enrollment.totp.secret||"";}
    dialog.showModal();
    return await new Promise((resolve,reject)=>{
      dialog.oncancel=event=>event.preventDefault();
      $("#cancelMfa").onclick=async()=>{await backend.auth.signOut();dialog.close();reject(new Error("已退出登录"));};
      form.onsubmit=async event=>{
        event.preventDefault();const button=form.querySelector('button[type="submit"]'),code=String(form.elements.code.value||"").trim();
        if(!/^\d{6}$/.test(code))return $("#mfaError").textContent="请输入6位动态验证码";
        button.disabled=true;$("#mfaError").textContent="";
        try{
          const verified=await backend.auth.mfa.challengeAndVerify({factorId:factor.id,code});
          if(verified.error)throw verified.error;
          const next=await backend.auth.mfa.getAuthenticatorAssuranceLevel();
          if(next.error||next.data?.currentLevel!=="aal2")throw next.error||new Error("双重验证状态未生效");
          dialog.close();resolve();
        }catch(error){$("#mfaError").textContent="验证码无效或已过期，请输入验证器当前显示的号码";}
        finally{button.disabled=false;}
      };
    });
  }

  async function loadBackendState(preferredMeetingId = null) {
    const { data: authData } = await backend.auth.getUser();
    if (!authData.user) throw new Error("登录已过期");
    const [profileRes,projectsRes]=await Promise.all([backend.from("profiles").select("display_name,phone,role").eq("user_id",authData.user.id).maybeSingle(),backend.from("meetings").select("*").is("archived_at",null).order("created_at",{ascending:false})]);
    if(profileRes.error||!profileRes.data)throw new Error("当前账号尚未建立人员资料"); if(projectsRes.error)throw new Error("请先运行项目权限数据库升级脚本");
    const manageableProjects=projectsRes.data||[]; const accountRole=isReadOnlyStaff()?"sales":staffAccess.systemRole==="client"?"client":profileRes.data.role;projectMemberships=manageableProjects.map(meeting=>({meeting_id:meeting.id,role:accountRole,display_name:profileRes.data.display_name,phone:profileRes.data.phone,meetings:meeting}));
    if (!manageableProjects.length) {
      const blank = initialState(); backendMeetingId = null;
      state = { ...blank, currentUserId:authData.user.id, activeProjectId:null, projects:[], users:[{id:authData.user.id,name:profileRes.data.display_name,role:accountRole,label:signedInAccessLabel(),phone:profileRes.data.phone||""}], attendees:[], notifications:[], locks:{master:false,columns:[],rows:[]} };
      localStorage.removeItem("journey-desk-active-project"); return;
    }
    const savedProjectId = localStorage.getItem("journey-desk-active-project");
    backendMeetingId = [preferredMeetingId,savedProjectId,backendMeetingId].find(id => projectMemberships.some(item => item.meeting_id === id)) || projectMemberships[0].meeting_id;
    localStorage.setItem("journey-desk-active-project",backendMeetingId);
    const activeMembership = projectMemberships.find(item => item.meeting_id === backendMeetingId);
    const auditQuery=(isSystemAdmin()?backend.from("operation_audit_logs").select("*"):backend.from("operation_audit_logs").select("*").eq("meeting_id",backendMeetingId)).order("created_at",{ascending:false}).limit(300);
    const [meetingRes, membersRes, attendeesRes, locksRes, noticesRes, logsRes, registrantsRes] = await Promise.all([
      backend.from("meetings").select("*").eq("id", backendMeetingId).single(),
      backend.from("meeting_members").select("*").eq("meeting_id", backendMeetingId),
      backend.from("attendees").select("*,transports(*)").eq("meeting_id", backendMeetingId).order("created_at", { ascending: false }),
      backend.from("column_locks").select("*").eq("meeting_id", backendMeetingId),
      backend.from("notifications").select("*").eq("meeting_id", backendMeetingId).order("created_at", { ascending: false }).limit(100),
      auditQuery,
      backend.from("registrants").select("id,display_name,employee_no,region,created_at").eq("meeting_id",backendMeetingId),
    ]);
    for (const result of [meetingRes, membersRes, attendeesRes, locksRes, noticesRes, logsRes, registrantsRes]) if (result.error) throw result.error;
    const meeting = meetingRes.data;
    const registrantsById=new Map((registrantsRes.data||[]).map(registrant=>[registrant.id,registrant]));
    state = {
      currentUserId: authData.user.id,
      activeProjectId: backendMeetingId,
      projects: projectMemberships.map(item => { const m = item.meetings || {}; return { id:item.meeting_id, slug:m.slug, name:m.name, luggageEnabled:!!m.luggage_enabled, luggageUsed:!!m.luggage_used, activityType:m.activity_type||"external", identifier:m.project_identifier||m.slug, activityOwner:m.activity_owner||"", activityDate:m.activity_date||m.start_date||"", clientName:m.client_name||"", role:item.role, ownerUserId:m.owner_user_id||null, archiveReady:!!m.archive_ready, registrationOpen:!!m.registration_open, templateImported:!!m.template_imported_at, managerEditEnabled:!!m.manager_attendee_edit_enabled, startDate:m.start_date||"", endDate:m.end_date||"", brandColor:m.brand_color||"#5267d9" }; }),
      users: membersRes.data.map(p => ({ id:p.user_id, name:p.display_name, role:p.role, label:p.user_id===authData.user.id&&isReadOnlyStaff()?"只读查看":({ops:"会务负责人",client:"会议负责人（客户）",sales:"销售负责人"})[p.role], phone:p.phone||"" })),
      settings: { settingsVersion:Number(meeting.settings_version)||0, luggageEnabled:!!meeting.luggage_enabled, luggageUsed:!!meeting.luggage_used, luggageConfigured:Object.hasOwn(meeting,"luggage_enabled"), eventName:meeting.name, slug:meeting.slug, activityType:meeting.activity_type||"external", identifier:meeting.project_identifier||meeting.slug, activityOwner:meeting.activity_owner||"", activityDate:meeting.activity_date||meeting.start_date||"", clientName:meeting.client_name||"", startDate:meeting.start_date||"", endDate:meeting.end_date||"", venues:[...new Set((meeting.venues||[]).map(normalizeVenueLabel).filter(Boolean))], servicePhone:meeting.service_phone||"", brandColor:meeting.brand_color||"#5267d9", deadline:meeting.deadline?.slice(0,16)||"", capacity:meeting.capacity, allowedCities:meeting.allowed_departure_cities||[], mismatchRule:meeting.check_city_mismatch, departureRule:meeting.check_departure_city, flightLeadMinutes:meeting.flight_lead_minutes??120, trainLeadMinutes:meeting.train_lead_minutes??90, transportGroupMinutes:meeting.transport_group_minutes??30, transportStationRules:Array.isArray(meeting.field_config?.transportStationRules)?meeting.field_config.transportStationRules:[], transferCollectionEnabled:!!meeting.transfer_collection_enabled, transferCollectionRoles:Array.isArray(meeting.transfer_collection_roles)?meeting.transfer_collection_roles:[], fieldConfig:{title:true,hcpId:true,accommodation:true,flight:true,mslContact:true,remarks:true,clothingSize:false,internalRoomingMode:"manual",...(meeting.field_config||{})}, registrationQuotas:Array.isArray(meeting.field_config?.registrationQuotas)?meeting.field_config.registrationQuotas:[], quotaRegions:Array.isArray(meeting.field_config?.quotaRegions)?meeting.field_config.quotaRegions:[], templateName:meeting.template_name||"", templateStoragePath:meeting.template_storage_path||"", templateIsSystemDefault:!!meeting.template_is_system_default, registrationTemplate:meeting.registration_template?.columns?.length ? meeting.registration_template : {version:1,columns:[]}, templateImported:!!meeting.template_imported_at, registrationOpen:!!meeting.registration_open, managerEditEnabled:!!meeting.manager_attendee_edit_enabled },
      locks: { master: meeting.master_locked, columns: locksRes.data.filter(l => l.locked).map(l => l.field_group), rows: attendeesRes.data.filter(a => a.row_locked).map(a => a.id) },
      attendees: attendeesRes.data.map(row=>fromDbAttendee({...row,_registrant:registrantsById.get(row.registrant_id)||null})),
      notifications: (()=>{const attendeeNames=new Map(attendeesRes.data.map(a=>[a.id,a.name]));const labelMap={name:"姓名",city:"城市",hospital:"医院/连锁",department:"科室/门店",title:"职称",venue:"会场",id_number:"证件号码",phone:"手机号",hcp_id:"客户编号",accommodation:"住宿",depart_date:"出发日期",depart_city:"出发城市",depart_transport_type:"出发出行方式",depart_station:"出发场站",arrive_date:"抵达日期",arrive_city:"抵达城市",arrive_transport_type:"抵达出行方式",arrive_station:"抵达场站",return_depart_date:"返程出发日期",return_depart_city:"返程出发城市",return_depart_transport_type:"返程出发方式",return_depart_station:"返程出发场站",return_arrive_date:"返程抵达日期",return_arrive_city:"返程抵达城市",return_arrive_transport_type:"返程抵达方式",return_arrive_station:"返程抵达场站",out_date:"去程日期",out_from:"去程出发城市",out_to:"去程到达城市",out_no:"去程航班/车次",out_departure:"去程出发时间",out_arrival:"去程到达时间",return_date:"返程日期",return_from:"返程出发城市",return_to:"返程到达城市",return_no:"返程航班/车次",return_departure:"返程出发时间",return_arrival:"返程到达时间",region:"大区",remarks:"备注",custom_fields:"分房/扩展信息",business_status:"报名状态"};const logs=(logsRes.data||[]).map(log=>{const before=log.before_data||{},after=log.after_data||{};const raw=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(field=>!["updated_at","created_at","risks","approval"].includes(field)&&JSON.stringify(before[field])!==JSON.stringify(after[field])).map(field=>({field,label:labelMap[field]||field,before:typeof before[field]==="object"?JSON.stringify(before[field]):before[field],after:typeof after[field]==="object"?JSON.stringify(after[field]):after[field]}));const cancelled=/cancel/.test(log.action)||raw.some(change=>change.field==="business_status"&&change.after==="cancelled");const attendeeName=after.name||before.name||attendeeNames.get(log.attendee_id)||"";return{id:`audit-${log.id}`,type:/create/.test(log.action)?"create":"change",text:`${log.actor_label||"系统"} · ${log.action}${attendeeName?` · ${attendeeName}`:""}${raw.length?`（${raw.length}项）`:""}`,time:log.created_at,read:cancelled,auditOnly:cancelled,attendeeName,actorName:log.actor_label||"系统",changes:raw};});const notices=(noticesRes.data||[]).map(n=>({id:n.id,type:n.type,text:n.message,time:n.created_at,read:!!n.read_at}));return[...logs,...notices].sort((a,b)=>new Date(b.time)-new Date(a.time));})(),
    };
    const noticeMetadata=new Map((noticesRes.data||[]).map(item=>[String(item.id),item]));
    state.notifications.forEach(item=>{
      const meta=noticeMetadata.get(String(item.id));
      if(meta){item.publicSource=meta.source==="public_registration";item.auditOnly=!item.publicSource;item.attendeeName=attendeesRes.data.find(a=>a.id===meta.attendee_id)?.name||"";item.actorName=meta.actor_label||"报名端参会人员";item.changes=Array.isArray(meta.change_details)?meta.change_details:[];}
      else if(String(item.id).startsWith("audit-")){item.auditOnly=true;item.read=true;}
    });
    state.settings.travelApprovalRules={...initialState().settings.travelApprovalRules,...(meeting.field_config?.travelApprovalRules||{})};
    state.settings.roomingRules={...initialState().settings.roomingRules,...(meeting.field_config?.roomingRules||{})};
    if (!state.users.some(user => user.id === authData.user.id)) {
      const profileName=profileRes.data.display_name?.trim();
      state.users.push({id:authData.user.id,name:profileName,role:accountRole,label:signedInAccessLabel(),phone:profileRes.data.phone||""});
    } else {
      const signedInUser=state.users.find(user=>user.id===authData.user.id);signedInUser.role=accountRole;signedInUser.label=signedInAccessLabel();
    }
    persistStateLocally();
    syncActiveProjectQuery();
    await loadProjectArchiveStates();
    await loadStaffDirectory();
    await loadProjectClientAccounts();
    const systemConfig=await backend.from("system_configuration").select("settings").eq("singleton",true).maybeSingle();
    if(!systemConfig.error&&systemConfig.data?.settings)localStorage.setItem(SYSTEM_PREFS_KEY,JSON.stringify({...loadSystemPreferences(),...systemConfig.data.settings}));
    const [stationRows,aliasRows]=await Promise.all([
      fetchAllStationRows(),
      backend.from("city_alias").select("alias_name,standard_city_name").order("alias_name"),
    ]);
    if(!stationRows.error&&stationRows.data?.length)localStorage.setItem(SYSTEM_PREFS_KEY,JSON.stringify({...loadSystemPreferences(),stationDictionary:stationRows.data.map(row=>({city:row.city_name,type:row.transport_type,name:row.station_name,shortName:row.station_short_name||""})),cityAliases:aliasRows.error?[]:(aliasRows.data||[]).map(row=>({alias:row.alias_name,city:row.standard_city_name}))}));
  }

  function fromDbAttendeeBase(row) {
    row.custom_fields={...(row.custom_fields||{}),_travelVerifiedHighlights:Array.isArray(row.verify_highlight_fields)?row.verify_highlight_fields:(row.custom_fields?._travelVerifiedHighlights||[])};
    const trip = direction => {
      const t = row.transports?.find(item => item.direction === direction) || {};
      return { driver: t.driver_name || "待分配", staffName:t.staff_name||"", phone: t.driver_phone || "—", vehicle: t.vehicle || "待分配", time: t.service_time ? new Date(t.service_time).toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-") : "", point: t.meeting_point || "", mode:t.service_mode||"", batchId:t.batch_id||"", batchName:t.batch_name||"", terminal:t.terminal||"", placard:t.placard||"", placardFilePath:t.placard_file_path||"", placardFileName:t.placard_file_name||"", placardFileSize:Number(t.placard_file_size)||0, capacity:t.capacity||null, notes:t.notes||"", timeStrategy:t.time_strategy||"", timeSource:t.time_source||"" };
    };
    return TravelFields.applyLegacy({ id:row.id, attendeeType:row.attendee_type||"", name:row.name, city:row.city||"", hospital:row.hospital||"", department:row.department||"", title:row.title||"", venue:normalizeVenueLabel(row.venue), sex:row.sex||"", idNumber:row.id_number, phone:row.phone, hcpId:row.hcp_id, accommodation:row.accommodation?"Y":"N", flight:row.is_flight?"Y":"N", region:row.region||"", contactName:row.contact_name||"", contactMobile:row.contact_mobile||"", mslContact:row.msl_contact||"", remarks:row.remarks||"", customFields:row.custom_fields||{}, privacyLetterStatus:normalizePrivacyStatus(row.privacy_letter_status), privacyLetterFilePath:row.privacy_letter_file_path||"", privacyLetterFileName:row.privacy_letter_file_name||"", privacyLetterFileSize:Number(row.privacy_letter_file_size)||0, privacyLetterUploadedAt:row.privacy_letter_uploaded_at||"", privacyLetterUploadedBy:row.privacy_letter_uploaded_by||null, ticketStatus:row.ticket_status||"pending", outboundApproval:row.outbound_approval_status||"", returnApproval:row.return_approval_status||"", ownerId:row.owner_id, registrantId:row.registrant_id||null, registrantName:row._registrant?.display_name||"", registrantEmployeeNo:row._registrant?.employee_no||"", registrantRegion:row._registrant?.region||"", registrantCreatedAt:row._registrant?.created_at||"", businessStatus:row.business_status||"active", departDate:row.depart_date||"", departCity:row.depart_city||"", departTransportType:row.depart_transport_type||"", departStation:row.depart_station||"", arriveDate:row.arrive_date||"", arriveCity:row.arrive_city||"", arriveTransportType:row.arrive_transport_type||"", arriveStation:row.arrive_station||"", returnDepartDate:row.return_depart_date||"", returnDepartCity:row.return_depart_city||"", returnDepartTransportType:row.return_depart_transport_type||"", returnDepartStation:row.return_depart_station||"", returnArriveDate:row.return_arrive_date||"", returnArriveCity:row.return_arrive_city||"", returnArriveTransportType:row.return_arrive_transport_type||"", returnArriveStation:row.return_arrive_station||"", outDate:row.out_date||"", outFrom:row.out_from||"", outTo:row.out_to||"", outNo:row.out_no||"", outDeparture:(row.out_departure||"").slice(0,5), outArrival:(row.out_arrival||"").slice(0,5), returnDate:row.return_date||"", returnFrom:row.return_from||"", returnTo:row.return_to||"", returnNo:row.return_no||"", returnDeparture:(row.return_departure||"").slice(0,5), returnArrival:(row.return_arrival||"").slice(0,5), approval:row.approval, risks:row.risks||[], createdAt:row.created_at, transport:{pickup:trip("pickup"),dropoff:trip("dropoff")} });
  }

  function fromDbAttendee(row) {
    return Object.assign(fromDbAttendeeBase(row),{outboundTransferOrigin:row.outbound_transfer_origin||"",outboundTransferTime:(row.outbound_transfer_time||"").slice(0,16),outboundTransferNotes:row.outbound_transfer_notes||"",returnTransferDestination:row.return_transfer_destination||"",returnTransferTime:(row.return_transfer_time||"").slice(0,16),returnTransferNotes:row.return_transfer_notes||""});
  }

  function toDbAttendeeBase(a) {
    a.customFields={...(a.customFields||{}),_travelVerifiedHighlights:[...(a.customFields?._travelVerifiedHighlights||[])]};
    TravelFields.applyLegacy(a);
    return { id:a.id, meeting_id:backendMeetingId, owner_id:a.ownerId, registrant_id:a.registrantId||null, business_status:a.businessStatus||"active", attendee_type:a.attendeeType||null, name:a.name, city:a.city||null, hospital:a.hospital||null, department:a.department||null, title:a.title||null, venue:normalizeVenueLabel(a.venue)||null, sex:a.sex||null, id_number:a.idNumber, phone:a.phone, hcp_id:a.hcpId, accommodation:a.accommodation==="Y", is_flight:a.flight==="Y", depart_date:dbDate(a.departDate), depart_city:a.departCity||null, depart_transport_type:a.departTransportType||null, depart_station:a.departTransportType==="LOCAL_ATTEND"?null:TravelFields.officialStation(a.departStation,a.departTransportType,stationDictionary()), arrive_date:dbDate(a.arriveDate), arrive_city:a.arriveCity||null, arrive_transport_type:a.arriveTransportType||null, arrive_station:a.arriveTransportType==="LOCAL_ATTEND"?null:TravelFields.officialStation(a.arriveStation,a.arriveTransportType,stationDictionary()), return_depart_date:dbDate(a.returnDepartDate), return_depart_city:a.returnDepartCity||null, return_depart_transport_type:a.returnDepartTransportType||null, return_depart_station:a.returnDepartTransportType==="LOCAL_ATTEND"?null:TravelFields.officialStation(a.returnDepartStation,a.returnDepartTransportType,stationDictionary()), return_arrive_date:dbDate(a.returnArriveDate), return_arrive_city:a.returnArriveCity||null, return_arrive_transport_type:a.returnArriveTransportType||null, return_arrive_station:a.returnArriveTransportType==="LOCAL_ATTEND"?null:TravelFields.officialStation(a.returnArriveStation,a.returnArriveTransportType,stationDictionary()), out_date:dbDate(a.outDate), out_from:a.outFrom||null, out_to:a.outTo||null, out_no:a.outNo||null, out_departure:dbTime(a.outDeparture), out_arrival:dbTime(a.outArrival), return_date:dbDate(a.returnDate), return_from:a.returnFrom||null, return_to:a.returnTo||null, return_no:a.returnNo||null, return_departure:dbTime(a.returnDeparture), return_arrival:dbTime(a.returnArrival), region:a.region||null, contact_name:a.contactName||null, contact_mobile:a.contactMobile||null, msl_contact:a.mslContact||null, remarks:a.remarks||null, custom_fields:a.customFields||{}, privacy_letter_status:normalizePrivacyStatus(a.privacyLetterStatus), privacy_letter_file_path:a.privacyLetterFilePath||null, privacy_letter_file_name:a.privacyLetterFileName||null, privacy_letter_file_size:a.privacyLetterFileSize||null, privacy_letter_uploaded_at:a.privacyLetterUploadedAt||null, privacy_letter_uploaded_by:a.privacyLetterUploadedBy||null, ticket_status:a.ticketStatus||"pending", outbound_approval_status:segmentApproval(a,"outbound"), return_approval_status:segmentApproval(a,"return"), approval:a.approval, risks:a.risks||[], row_locked:state.locks.rows.includes(a.id) };
  }

  function toDbAttendee(a) {
    return {...toDbAttendeeBase(a),outbound_transfer_origin:a.outboundTransferOrigin||null,outbound_transfer_time:a.outboundTransferTime||null,outbound_transfer_notes:a.outboundTransferNotes||null,return_transfer_destination:a.returnTransferDestination||null,return_transfer_time:a.returnTransferTime||null,return_transfer_notes:a.returnTransferNotes||null};
  }

  async function syncBackend() {
    if (!backend || !backendMeetingId) return;
    const attendeeRows = state.attendees.map(toDbAttendee);
    if (attendeeRows.length&&canEditAttendeeData()) { const { error } = await backend.from("attendees").upsert(attendeeRows); if (error) throw error; }
    const transportRows = state.attendees.flatMap(a => ["pickup","dropoff"].map(direction => { const t = a.transport?.[direction] || {}; return { attendee_id:a.id, direction, driver_name:t.driver||null, staff_name:t.staffName||null, driver_phone:t.phone||null, vehicle:t.vehicle||null, service_time:direction==="pickup"?null:parseServiceTime(t.time), meeting_point:direction==="pickup"?null:(t.point||null), service_mode:t.mode||null, batch_id:t.batchId||null, batch_name:t.batchName||null, terminal:transportTerminal(a,direction)||null, placard:direction==="pickup"?(t.placard||null):null, placard_file_path:direction==="pickup"?(t.placardFilePath||null):null, placard_file_name:direction==="pickup"?(t.placardFileName||null):null, placard_file_size:direction==="pickup"?(t.placardFileSize||null):null, capacity:t.capacity||null, notes:t.notes||null, time_strategy:t.timeStrategy||null, time_source:t.timeSource||null }; }));
    if (transportRows.length) { const { error } = await backend.from("transports").upsert(transportRows,{onConflict:"attendee_id,direction"}); if (error) throw error; }
    toast("已同步到云端");
  }

  const settingsConflict = error => error?.code === "40001" || /已被其他页面|刷新后重试/.test(error?.message||"");
  async function persistMeetingSettings(patch) {
    if (!backend || !backendMeetingId) return;
    const {data,error}=await backend.rpc("update_meeting_settings",{p_meeting_id:backendMeetingId,p_expected_version:Number(state.settings.settingsVersion)||0,p_patch:patch});
    if(error)throw error;
    state.settings.settingsVersion=Number(data?.settingsVersion)||state.settings.settingsVersion+1;
    persistStateLocally();
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
    let target = (location.hash || "#dashboard").slice(1).split("?")[0];
    if (offlineLuggageSession && target !== "luggage") { target="luggage"; history.replaceState(null,"","#luggage"); toast("当前仅恢复本场行李离线操作；其他功能请联网后刷新", "error"); }
    if (luggageIntegration && !luggageIntegration.canLeave()) { history.replaceState(null,"","#luggage"); toast("行李正在保存，请稍后离开", "error"); return; }
    const isPublic = ["portal", "lookup", "register", "manage"].includes(target);
    $("#adminApp").classList.toggle("is-hidden", isPublic);
    $("#publicPortalView").classList.toggle("is-hidden", !isPublic);
    if (isPublic) { luggageIntegration?.unmount(); setPortalTab(target === "lookup" ? "lookup" : target === "manage" ? "manage" : "register"); if (!publicProjectConfig || Date.now()-publicProjectLoadedAt>5000) loadPublicProjectInfo(); scrollTo({ top: 0, behavior: "instant" }); return; }
    const requestedRoute = $( `[data-page="${target}"]`) ? target : "dashboard"; let routeName = !state.activeProjectId && requestedRoute !== "projects" ? "projects" : requestedRoute;
    if(routeName==="luggage" && !luggageIntegration.available()) { routeName="settings"; history.replaceState(null,"","#settings"); toast("请先在本场会议设置中启用行李管理", "error"); }
    if(routeName==="system"&&!isSystemAdmin()){routeName="dashboard";toast("系统设置仅限超级管理员访问","error");}
    if (routeName !== requestedRoute && requestedRoute !== "luggage") { history.replaceState(null,"",state.activeProjectId?"#dashboard":"#projects"); toast("请先新建会议，再进行报名和行程管理", "error"); }
    $$(".page").forEach(page => page.classList.toggle("active", page.dataset.page === routeName));
    $$("[data-route]").forEach(link => link.classList.toggle("active", link.dataset.route === routeName||(routeName==="settings"&&link.dataset.route==="projects")));
    scrollTo({ top: 0, behavior: "instant" });
    renderAll();
    if (routeName === "verification") renderVerificationPage();
    if (routeName === "projects") loadProjectArchiveStates();
  }

  function bindForms() {
    bindJourneyForm($("#registrationForm"));
    $("#registrationForm").addEventListener("reset",()=>setTimeout(()=>bindJourneyForm($("#registrationForm")),0));
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
    $("#documentFile").addEventListener("change", event => $("#documentFileName").textContent = event.target.files.length ? `已选择 ${event.target.files.length} 个文件` : "支持多选，单个文件最大 50MB");
    $("#openProjectDocuments").addEventListener("click", openProjectDocumentsDialog);
    $("#userSelect").addEventListener("change", event => { luggageIntegration?.unmount(); state.currentUserId = event.target.value; saveState(); renderAll(); toast(`已切换为${currentUser().label}`); });
    $("#attendeeSearch").addEventListener("input", renderAttendeeTable);
    $("#riskFilter").addEventListener("change", renderAttendeeTable);
    $("#venueFilter").addEventListener("change", renderAttendeeTable);
    $("#toggleIncompleteFilter").addEventListener("click",()=>{incompleteRosterOnly=!incompleteRosterOnly;renderAttendeeTable();});
    $("#toggleCancelledRoster").addEventListener("click",()=>{cancelledRosterView=!cancelledRosterView;selectedAttendeeIds.clear();renderAttendeeTable();});
    $("#deleteSelectedAttendees").addEventListener("click",deleteSelectedAttendees);
    $("#transportSearch").addEventListener("input", renderTransport);
    $("#roomingSearch").addEventListener("input",renderRooming);
    $("#roomingStatusFilter").addEventListener("change",renderRooming);
    $("#roomingOccupancyFrom").addEventListener("change",renderRooming);
    $("#roomingOccupancyTo").addEventListener("change",renderRooming);
    $("#resetRoomingOccupancyRange").addEventListener("click",()=>{$("#roomingOccupancyFrom").value="";$("#roomingOccupancyTo").value="";renderRooming();});
    $("#exportRoomingOccupancy").addEventListener("click",exportRoomingOccupancy);
    $("#applyRoomingSuggestions").addEventListener("click",applyRoomingSuggestions);
    $("#exportRoomingList").addEventListener("click",exportRoomingList);
    $("#closeTravelVerification").addEventListener("click",()=>$("#travelVerificationDialog").close());
    $("#newPickupBatch").addEventListener("click", () => openTransportBatch("pickup"));
    $("#newDropoffBatch").addEventListener("click", () => openTransportBatch("dropoff"));
    $("#autoArrangeTransport").addEventListener("click", autoArrangeTransport);
    $("#exportTransportPlan").addEventListener("click", exportTransportPlan);
    $("#cancelTransportBatch").addEventListener("click", () => $("#transportBatchDialog").close());
    ["serviceDate","terminal","timeStrategy"].forEach(name => $("#transportBatchForm").elements[name].addEventListener("input", renderBatchCandidates));
    $("#transportBatchForm").elements.capacity.addEventListener("input",updateBatchCapacityNotice);
    $("#addTransportStationRule").addEventListener("click",()=>{state.settings.transportStationRules=[...(state.settings.transportStationRules||[]),{station:"",minutes:90}];renderTransportStationRules();});
    $("#selectAllBatchAttendees").addEventListener("change", event => { $$('[name="batchAttendee"]',$("#batchAttendeeList")).forEach(input=>input.checked=event.target.checked); updateBatchCapacityNotice(); });
    $$('[data-transport-filter]').forEach(button => button.addEventListener("click", () => { activeTransportFilter = button.dataset.transportFilter; $$('[data-transport-filter]').forEach(b => b.classList.toggle("active", b === button)); renderTransport(); }));
    $("#exportExcel").addEventListener("click", exportExcel);
    $("#transferRegistrant").addEventListener("click", openRegistrantTransfer);
    $("#transferRegistrantForm").addEventListener("submit", submitRegistrantTransfer);
    $("#auditTravel").addEventListener("click",()=>{location.hash="verification";});
    $("#verifyRosterButton").addEventListener("click",auditRosterTravel);
    $("#verificationFilter").addEventListener("change",renderVerificationPage);
    $("#verificationSearch").addEventListener("input",renderVerificationPage);
    $("#importRoster").addEventListener("click", openRosterImport);
    $("#rosterFile").addEventListener("change", event => readRosterFile(event.target.files[0]));
    $("#projectTemplateFile").addEventListener("change", event => readProjectTemplate(event.target.files[0]));
    $("#downloadProjectTemplate").addEventListener("click", downloadProjectTemplate);
    $("#removeProjectTemplateAttachment").addEventListener("click", removeProjectTemplateAttachment);
    $("#resetProjectTemplate").addEventListener("click", resetProjectTemplate);
    $("#registrationOpenSwitch").addEventListener("change", toggleRegistrationOpen);
    $("#managerEditSwitch").addEventListener("change", toggleManagerEdit);
    $("#confirmImport").addEventListener("click", confirmRosterImport);
    $("#cancelImport").addEventListener("click", () => $("#importDialog").close());
    const dropzone=$("#importDropzone");
    ["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add("dragging");}));
    ["dragleave","drop"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove("dragging");}));
    dropzone.addEventListener("drop",event=>readRosterFile(event.dataTransfer.files[0]));
    $("#markAllRead").addEventListener("click", async () => { state.notifications.forEach(n => n.read = true); persistStateLocally(); if (backend && backendMeetingId) await backend.from("notifications").update({read_at:new Date().toISOString()}).eq("meeting_id",backendMeetingId).is("read_at",null); renderNotifications(); renderCounts(); });
    $("#masterLock").addEventListener("change", async event => { if (!canManage()) return deny();const previous=state.locks.master;state.locks.master=event.target.checked;try{if(backend){const{error}=await backend.from("meetings").update({master_locked:state.locks.master}).eq("id",backendMeetingId);if(error)throw error;}addNotification("lock", `${currentUser().name}${event.target.checked ? "锁定" : "解锁"}了全部名单`);saveState();renderAll();}catch(error){state.locks.master=previous;renderAll();toast(`全体锁定保存失败：${error.message}`,"error");} });
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
    $("#downloadBackup").addEventListener("click",downloadSystemBackup);
    $("#restoreBackupFile").addEventListener("change",event=>restoreSystemBackup(event.target.files[0]));
    $("#saveSystemDictionary").addEventListener("click",saveSystemPreferences);
    ["systemTheme","systemBrandColor","tableDensity","backupInterval","variflightDailyLimit","variflightUnlimited","variflightGlobalEnabled","maxConcurrentDevices"].forEach(id=>$("#"+id).addEventListener("change",saveSystemPreferences));
    $("#createAdminAccessLink").addEventListener("click",createAdminAccessLink);
    $("#globalLogSearch").addEventListener("input",renderSystemSettings);
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

  function greetingForHour(hour=new Date().getHours()) {
    if(hour>=5&&hour<11)return "早上好";
    if(hour>=11&&hour<14)return "中午好";
    if(hour>=14&&hour<18)return "下午好";
    return "晚上好";
  }

  function renderGreeting() {
    $("#greetingText").textContent=greetingForHour();
    $("#greetingName").textContent=currentUser().name;
  }

  function renderAll() {
    const user = currentUser();
    renderGreeting();
    $("#userAvatar").textContent = user.name.slice(0, 1);
    const visual=projectVisual(currentProject()); $("#activeProjectIcon").textContent=visual.icon; $("#activeProjectIcon").style.setProperty("--project-accent",visual.color); document.documentElement.style.setProperty("--project-accent",visual.color);
    $("#projectSelect").disabled=!!offlineLuggageSession;
    $("#newProjectButton").disabled=!!offlineLuggageSession;
    $("#systemSettingsNav").classList.toggle("is-hidden",!isSystemAdmin());
    renderRegistrationOwner(); renderCounts(); renderDashboard(); renderAttendeeTable(); renderApprovals(); renderRooming(); renderTransport(); renderLocks(); renderNotifications(); renderSettings(); renderProjects(); renderDocuments(); renderSystemSettings(); renderQr(); luggageIntegration?.render(); renderVerificationPage();
  }

  function renderProjects() {
    $("#projectGrid").innerHTML = state.projects.map(project => {
      const active = project.id === state.activeProjectId; const role = project.ownerUserId===state.currentUserId?"我的项目":isSystemAdmin()?"管理员可管理":"项目负责人"; const visual=projectVisual(project); const archive=projectArchiveStates[project.id]||{files:[]};
      return `<article class="panel project-card ${active ? "active" : ""}" style="--project-color:${visual.color}"><div class="project-card-top"><span class="project-card-icon">${visual.icon}</span><span class="status ${active ? "status-normal" : ""}">${active ? "当前会议" : escapeHtml(role)}</span></div><h2>${escapeHtml(project.name)}</h2><p>${project.activityType === "internal" ? "内部活动 · 合同编号" : "外部活动 · 会议编码"}：${escapeHtml(project.identifier||project.slug)}</p><p>${escapeHtml(project.activityOwner||"负责人待补充")} · ${escapeHtml(project.activityDate||project.startDate||"日期待定")}</p><div class="project-archive-state ready"><b>${project.registrationOpen?"报名开关已开启":"报名开关已关闭"}</b><span>项目建档文件为可选附件，不影响报名及后续业务流程${archive.fileCount?` · 已归档 ${archive.fileCount} 个文件`:""}</span></div><label class="project-registration-switch"><span><strong>报名开放</strong><small>${project.templateImported?"使用当前报名模板":"无需模板，使用系统默认报名字段"}</small></span><span class="switch"><input type="checkbox" data-project-registration-open="${project.id}" ${project.registrationOpen?"checked":""}/><span></span></span></label><div class="project-actions"><button class="button button-primary" data-project-settings="${project.id}">会议详情 / 设置</button><a class="button button-secondary" href="${escapeHtml(projectPublicUrl(project))}" target="_blank" rel="noopener">打开报名界面 ↗</a><button class="button button-secondary" data-project-documents="${project.id}">项目建档文件</button><button class="text-button" data-edit-project="${project.id}">编辑基础信息</button><button class="text-button danger" data-delete-project="${project.id}">删除</button><button class="text-button" data-copy-project="${project.id}">复制</button><button class="text-button" data-copy-project-link="${project.id}">复制报名入口</button></div></article>`;
    }).join("");
    $$('[data-switch-project]').forEach(button => button.onclick = () => switchProject(button.dataset.switchProject));
    $$('[data-project-settings]').forEach(button=>button.onclick=async()=>{if(button.dataset.projectSettings!==state.activeProjectId)await switchProject(button.dataset.projectSettings);location.hash="settings";});
    $$('[data-project-documents]').forEach(button=>button.onclick=async()=>{if(button.dataset.projectDocuments!==state.activeProjectId)await switchProject(button.dataset.projectDocuments);openProjectDocumentsDialog();});
    $$('[data-edit-project]').forEach(button=>button.onclick=()=>openProjectDialog(state.projects.find(item=>item.id===button.dataset.editProject),"edit"));
    $$('[data-delete-project]').forEach(button=>button.onclick=()=>deleteProject(button.dataset.deleteProject));
    $$('[data-copy-project]').forEach(button => button.onclick = () => openProjectDialog(state.projects.find(item=>item.id===button.dataset.copyProject),"copy"));
    $$('[data-copy-project-link]').forEach(button => button.onclick = () => { const project=state.projects.find(item=>item.id===button.dataset.copyProjectLink); const url=projectPublicUrl(project); navigator.clipboard?.writeText(url).then(()=>toast("项目入口已复制")).catch(()=>toast(url)); });
    $$('[data-project-registration-open]').forEach(input=>input.onchange=()=>toggleProjectRegistration(input.dataset.projectRegistrationOpen,input.checked,input));
  }

  async function toggleProjectRegistration(projectId, enabled, control=null) {
    const project=state.projects.find(item=>item.id===projectId); if(!project)return;
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
    const entries=await Promise.all(state.projects.map(async project=>{try{const response=await fetch(`${DOCUMENT_API_BASE}/api/integrated/projects/${project.id}/documents`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)return[project.id,{fileCount:0}];const payload=await response.json();const summary=archiveSummary(payload.files);if(project.id===backendMeetingId)documentState={folder:payload.folder||null,files:payload.files||[],user:payload.user||null,loading:false};return[project.id,{...summary,fileCount:(payload.files||[]).length,folder:payload.folder||null}];}catch{return[project.id,{fileCount:0}];}}));
    projectArchiveStates=Object.fromEntries(entries); renderProjects();
  }

  async function deleteProject(projectId){
    const project=state.projects.find(item=>item.id===projectId); if(!project||!confirm(`确认删除项目“${project.name}”？项目资料、报名名单、行程和归档文件都将删除，无法恢复。`))return;
    try{const{error}=await backend.rpc("delete_meeting_project",{p_id:projectId});if(error)throw error;delete projectArchiveStates[projectId];const next=state.projects.find(item=>item.id!==projectId)?.id||null;await loadBackendState(next);populateUsers();populateProjects();renderAll();location.hash="projects";toast("项目已归档；参会数据和附件均保留，可由超级管理员恢复");}catch(error){toast(`归档失败：${error.message}`,"error");}
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

  function openProjectDocumentsDialog() {
    if(!backendMeetingId)return toast("请先新建并进入一个会议项目","error");
    $("#projectDocumentsDialog").showModal();
    loadDocuments();
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
    const files = documentState.files || []; const folder = documentState.folder;
    if ($("#navDocumentCount")) $("#navDocumentCount").textContent = files.length;
    $("#documentProjectLabel").textContent = currentProject().identifier || currentProject().slug || "未选择项目";
    $(".document-upload-panel").classList.toggle("is-hidden",!canManage());
    if (documentState.loading) $("#documentList").innerHTML = '<div class="empty-state">正在读取项目文件…</div>';
    else if (message) $("#documentList").innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    else if (!files.length) $("#documentList").innerHTML = '<div class="empty-state">暂未上传项目建档文件</div>';
    else $("#documentList").innerHTML = files.map(file=>{ const signed=file.type==="confirmation"&&file.documentStatus==="signed"; return `<div class="document-row"><span class="document-type-badge ${signed?"signed":""}">${escapeHtml(file.typeLabel||"项目附件")}${file.type==="confirmation"?` · ${signed?"已签署":"待签署"}`:""}</span><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><small>${formatDocumentSize(file.size)}</small><small>${escapeHtml(file.uploadedBy||"未知上传人")}<br>${new Date(file.uploadedAt).toLocaleString("zh-CN",{hour12:false})}</small><span class="document-actions"><button data-document-download="${file.id}" data-document-name="${escapeHtml(file.name)}">下载</button>${canManage()?`<button data-document-replace="${file.id}" data-document-type="${escapeHtml(file.type||"other")}" data-document-status="${escapeHtml(file.documentStatus||"")}">替换</button><button class="danger" data-document-delete="${file.id}">删除</button>`:""}</span></div>`;}).join("");
    if (folder && ["po_email","signed_confirmation"].includes(folder.complianceScenario) && isDocumentAdmin()) $("#documentScenario").value = folder.complianceScenario;
    updateDocumentTypeOptions(); bindDocumentRows();
  }

  function formatDocumentSize(bytes) { return bytes < 1024*1024 ? `${Math.max(1,Math.round(bytes/1024))} KB` : `${(bytes/1024/1024).toFixed(1)} MB`; }

  function bindDocumentRows() {
    $$('[data-document-download]').forEach(button=>button.onclick=async()=>{ try { const response=await documentApi(`/api/integrated/files/${button.dataset.documentDownload}?projectId=${backendMeetingId}`,{download:true}); const url=URL.createObjectURL(await response.blob()); const link=document.createElement("a"); link.href=url; link.download=button.dataset.documentName; link.click(); setTimeout(()=>URL.revokeObjectURL(url),30000); } catch(error){ toast(error.message,"error"); } });
    $$('[data-document-delete]').forEach(button=>button.onclick=async()=>{ if(!confirm("确认删除这个项目文件？"))return; try{await documentApi(`/api/integrated/files/${button.dataset.documentDelete}?projectId=${backendMeetingId}`,{method:"DELETE"});toast("文件已删除");await loadDocuments();renderProjects();}catch(error){toast(error.message,"error");} });
    $$('[data-document-replace]').forEach(button=>button.onclick=()=>{const input=document.createElement("input");input.type="file";input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{await uploadProjectDocumentFile(file,{type:button.dataset.documentType,status:button.dataset.documentStatus});await documentApi(`/api/integrated/files/${button.dataset.documentReplace}?projectId=${backendMeetingId}`,{method:"DELETE"});await loadDocuments();renderProjects();toast("文件已替换");}catch(error){toast(error.message,"error");}};input.click();});
  }

  async function uploadProjectDocumentFile(file,{type,status="",scenario=""}) {
    if(file.size>50*1024*1024)throw new Error(`${file.name} 超过 50MB`);
    if(!/\.(pdf|docx?|xlsx?|csv|jpe?g|png|webp|pptx?)$/i.test(file.name))throw new Error("仅支持 PDF、Office、CSV 和常用图片文件；禁止上传可执行文件");
    const query=new URLSearchParams({type,filename:file.name});if(status)query.set("status",status);if(scenario)query.set("scenario",scenario);
    return documentApi(`/api/integrated/projects/${backendMeetingId}/documents?${query}`,{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:file});
  }

  async function uploadDocument(event) {
    event.preventDefault(); const form=event.currentTarget; const files=[...form.elements.file.files]; const selectedType=form.elements.type.value; $("#documentError").textContent=""; if(!files.length||!selectedType)return $("#documentError").textContent="请选择文件类型和文件";
    const type=selectedType.startsWith("confirmation_")?"confirmation":selectedType; const status=selectedType==="confirmation_signed"?"signed":selectedType==="confirmation_pending"?"pending":""; const scenario=isDocumentAdmin()?form.elements.scenario.value:"";
    try { for(const file of files)await uploadProjectDocumentFile(file,{type,status,scenario});form.elements.file.value=""; $("#documentFileName").textContent="支持多选，单个文件最大 50MB"; await loadDocuments(); renderProjects(); toast(`已上传 ${files.length} 个项目建档文件`); }
    catch(error){ $("#documentError").textContent=error.message; }
  }

  function renderRegistrationOwner() {
    $$(".optional-transfer-section",$("#registrationForm")).forEach(section=>section.classList.toggle("is-hidden",!state.settings.transferCollectionEnabled));
    applyMeetingTypeFields($("#registrationForm"),state.settings);
  }

  function applyMeetingTypeFields(form, settings={}) {
    if(!form)return;
    const internal=isInternalMeeting(settings), clothing=settings.fieldConfig?.clothingSize===true;
    $$('[data-external-field]',form).forEach(label=>setMeetingFieldVisibility(label,!internal&&label.dataset.templateVisible!=="false"&&label.dataset.configVisible!=="false"));
    $$('[data-internal-field]',form).forEach(label=>setMeetingFieldVisibility(label,internal));
    $$('[data-clothing-field]',form).forEach(label=>setMeetingFieldVisibility(label,clothing));
    $$('[data-attendee-name-label]',form).forEach(label=>label.textContent=internal?"姓名":"客户姓名");
    form.dataset.meetingType=internal?"internal":"external";
  }
  function setMeetingFieldVisibility(label, visible) {
    label.classList.toggle("is-hidden",!visible);
    $$('input,select,textarea',label).forEach(input=>{
      if(input.dataset.meetingRequired===undefined)input.dataset.meetingRequired=String(input.required);
      input.disabled=!visible;
      input.required=visible&&input.dataset.meetingRequired==="true";
    });
  }

  function renderCounts() {
    const list = activeVisibleAttendees();
    const pending = list.filter(a => a.approval === "pending").length+list.filter(a=>roomingApprovalStatus(a)==="pending").length;
    const unread = state.notifications.filter(n => !n.read&&(n.publicSource||(!backend&&n.auditOnly!==true))).length;
    $("#navAttendeeCount").textContent = list.length;
    $("#navApprovalCount").textContent = pending || "";
    $("#navNoticeCount").textContent = unread || "";
    $("#topNoticeCount").textContent = unread;
  }

  const normalizeQuotaRole = value => /主席|主持|讲者|讨论嘉宾|组长|嘉宾|chair|moderator|speaker|panelist/i.test(String(value||"").trim()) ? "角色嘉宾" : "听众";
  const transferRoleFor = value => /赞助商|sponsor/i.test(String(value||""))?"赞助商":normalizeQuotaRole(value);
  const transferCollectionAllowed = (attendeeType,config=state.settings) => !!config?.transferCollectionEnabled&&(config.transferCollectionRoles||[]).includes(transferRoleFor(attendeeType));
  const guestMeetingRole = value => {
    const role=String(value||"").trim();
    if(/主席|chair/i.test(role))return "主席";
    if(/主持|moderator/i.test(role))return "主持";
    if(/讲者|speaker/i.test(role))return "讲者";
    if(/讨论嘉宾|组长|panelist/i.test(role))return "讨论嘉宾（组长）";
    return "角色嘉宾（未细分）";
  };
  const normalizeQuotaRegion = value => String(value||"").trim()||"未填写大区";
  const quotaKey = (venue,region,role) => [normalizeVenueLabel(venue),normalizeQuotaRegion(region),normalizeQuotaRole(role)].join("|");
  const quotaNumber = value => Math.max(0,Math.round(Number(value)||0));
  function normalizedQuotaConfiguration() {
    const grouped=new Map();
    (state.settings.registrationQuotas||[]).forEach(item=>{const normalized={venue:normalizeVenueLabel(item.venue),region:normalizeQuotaRegion(item.region),role:normalizeQuotaRole(item.role),quota:quotaNumber(item.quota)};if(normalized.role==="角色嘉宾")return;const key=quotaKey(normalized.venue,normalized.region,normalized.role);const previous=grouped.get(key);grouped.set(key,previous?{...previous,quota:previous.quota+normalized.quota}:normalized);});
    return [...grouped.values()];
  }
  function registrationQuotaRows(role=activeQuotaRole) {
    if(role==="角色嘉宾"||state.settings.activityType==="internal") {
      const actualGroups=new Map();
      activeVisibleAttendees().filter(attendee=>normalizeQuotaRole(attendee.attendeeType)===role).forEach(attendee=>{const item={venue:normalizeVenueLabel(attendee.venue)||"未填写会场",region:normalizeQuotaRegion(attendee.region),role:role==="角色嘉宾"?guestMeetingRole(attendee.attendeeType):"听众"};const key=[item.venue,item.region,item.role].join("|");actualGroups.set(key,{...item,quota:0,actual:(actualGroups.get(key)?.actual||0)+1,gap:0,remaining:0,percent:0});});
      return [...actualGroups.values()];
    }
    const configured=normalizedQuotaConfiguration();
    const actualMap=new Map(); activeVisibleAttendees().forEach(attendee=>{const key=quotaKey(attendee.venue,attendee.region,attendee.attendeeType);actualMap.set(key,(actualMap.get(key)||0)+1);});
    const rows=configured.filter(item=>item.role===role).map(item=>{const actual=actualMap.get(quotaKey(item.venue,item.region,item.role))||0;actualMap.delete(quotaKey(item.venue,item.region,item.role));return{...item,actual};});
    return rows.map(item=>{const gap=item.actual-item.quota;const remaining=Math.max(item.quota-item.actual,0);const percent=item.quota?item.actual/item.quota*100:item.actual?100:0;return{...item,gap,remaining,percent};});
  }
  function unmatchedQuotaAttendeeCount(role=activeQuotaRole) {
    if(role==="角色嘉宾")return 0;
    const configuredKeys=new Set(normalizedQuotaConfiguration().filter(item=>item.role===role).map(item=>quotaKey(item.venue,item.region,item.role)));
    return activeVisibleAttendees().filter(attendee=>normalizeQuotaRole(attendee.attendeeType)===role&&!configuredKeys.has(quotaKey(attendee.venue,attendee.region,attendee.attendeeType))).length;
  }
  function quotaRoleOptions() {
    return ["听众","角色嘉宾"];
  }
  const quotaState = row => row.gap<0?["shortage","缺口"]:row.gap>0?["over","超额"]:row.quota?["complete","达标"]:["neutral","持平"];
  function renderRegistrationProgress() {
    const roles=quotaRoleOptions();if(!roles.includes(activeQuotaRole))activeQuotaRole=roles[0]||"听众";
    $("#quotaRoleFilter").innerHTML=roles.map(role=>`<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join("");$("#quotaRoleFilter").value=activeQuotaRole;
    $("#quotaRoleTabs").innerHTML=roles.map(role=>`<button type="button" class="${role===activeQuotaRole?"active":""}" data-quota-role="${escapeHtml(role)}">${escapeHtml(role)}</button>`).join("");
    $$('[data-quota-role]').forEach(button=>button.onclick=()=>{activeQuotaRole=button.dataset.quotaRole;renderRegistrationProgress();});
    const internal=state.settings.activityType==="internal";$("#configureQuotas").classList.toggle("is-hidden",!canManage()||internal);
    $("#quotaProgressDescription").textContent=internal?"内部会议不设报名名额，以下数据直接来自当前有效参会名单。":"名额与实际报名均直接读取当前会议配置和有效参会名单。";$("#quotaDetailDescription").textContent=internal?"按实际会场、大区和会议角色统计，不计算名额、Gap 或完成率。":"Gap = 实际报名 - 分配名额";
    const rows=registrationQuotaRows();const unlimitedRole=activeQuotaRole==="角色嘉宾"||internal;const quotaConfigured=!unlimitedRole&&normalizedQuotaConfiguration().some(item=>item.role===activeQuotaRole);const quota=rows.reduce((sum,row)=>sum+row.quota,0);const actual=rows.reduce((sum,row)=>sum+row.actual,0);const unmatched=internal?0:unmatchedQuotaAttendeeCount();const totalActual=actual+unmatched;const gap=actual-quota;const remaining=Math.max(quota-actual,0);const percent=quota?actual/quota*100:0;
    const summaryCards=unlimitedRole?[
      ["名额限制",internal?"不启用":"不限",internal?"内部会议不做名额管控":"角色嘉宾不参与名额分配","quota"],["实际报名",actual,"直接读取当前有效名单","actual"],["涉及会场",new Set(rows.map(row=>row.venue)).size,"按实际报名会场汇总","over"],["涉及大区",new Set(rows.map(row=>row.region)).size,"按实际报名大区汇总","rate"],
    ]:quotaConfigured?[
      ["分配名额",quota,"当前类别目标","quota"],["实际报名",actual,unmatched?`另有 ${unmatched} 人的大区或会场未匹配配置`:"已匹配当前名额配置","actual"],[gap<0?"名额缺口":"名额差额",gap<0?remaining:`+${gap}`,gap<0?"仍需继续报名":"已达到或超过目标",gap<0?"shortage":"over"],["完成率",`${percent.toFixed(1)}%`,`${actual} / ${quota||0}`,"rate"],
    ]:[
      ["分配名额","未配置","点击右上角配置名额","quota"],["实际报名",totalActual,"配置名额后按预设大区匹配","actual"],["未匹配人数",unmatched,"不会自动生成非预设大区","over"],["统计类别",activeQuotaRole,"仅统计已配置名额范围","rate"],
    ];
    $("#quotaSummary").innerHTML=summaryCards.map(([label,value,note,type])=>`<div class="quota-summary-item ${type}"><small>${label}</small><strong>${escapeHtml(String(value))}</strong><span>${note}</span></div>`).join("");
    const byVenue=[...new Set(rows.map(row=>row.venue))].map(venue=>{const list=rows.filter(row=>row.venue===venue);const venueQuota=list.reduce((sum,row)=>sum+row.quota,0);const venueActual=list.reduce((sum,row)=>sum+row.actual,0);return{venue,quota:venueQuota,actual:venueActual,gap:venueActual-venueQuota,percent:venueQuota?venueActual/venueQuota*100:0};});
    $("#quotaVenueProgress").innerHTML=byVenue.length?byVenue.map(item=>`<div class="quota-venue-row"><div><strong>${escapeHtml(item.venue)}</strong><span>${quotaConfigured?`${item.actual} / ${item.quota} 人`:`当前名单 ${item.actual} 人`}</span></div><div class="quota-venue-numbers">${quotaConfigured?`<span>尚缺 <b class="${item.gap<0?"negative":"positive"}">${Math.max(-item.gap,0)}</b></span><strong>${item.percent.toFixed(1)}%</strong>`:`<span>分配名额待配置</span><strong>${item.actual}人</strong>`}</div><div class="quota-meter"><i class="${quotaConfigured&&item.percent>=100?"over":""}" style="width:${quotaConfigured?Math.min(item.percent,100):0}%"></i>${quotaConfigured?`<span style="left:${Math.min(item.percent,100)}%"></span>`:""}</div></div>`).join(""):`<div class="empty-state">当前名单中暂无${escapeHtml(activeQuotaRole)}数据</div>`;
    const alertHtml=(items,type)=>items.length?items.slice(0,3).map((row,index)=>`<div class="quota-alert-row"><b>${index+1}</b><span><strong>${escapeHtml(row.region)}</strong><small>${escapeHtml(row.venue)} · ${escapeHtml(row.role)}</small></span><em class="${type}">${row.gap>0?"+":""}${row.gap}</em></div>`).join(""):`<div class="quota-alert-empty">暂无${type==="shortage"?"名额缺口":"超额报名"}</div>`;
    $("#quotaShortageList").innerHTML=unlimitedRole?`<div class="quota-alert-empty">${internal?"内部会议":"角色嘉宾"}按实际报名统计，无缺口预警</div>`:quotaConfigured?alertHtml(rows.filter(row=>row.gap<0).sort((a,b)=>a.gap-b.gap),"shortage"):`<div class="quota-alert-empty">配置分组名额后生成缺口预警</div>`;$("#quotaOverList").innerHTML=unlimitedRole?`<div class="quota-alert-empty">${internal?"内部会议":"角色嘉宾"}按实际报名统计，无超额提醒</div>`:quotaConfigured?alertHtml(rows.filter(row=>row.gap>0).sort((a,b)=>b.gap-a.gap),"over"):`<div class="quota-alert-empty">配置分组名额后生成超额提醒</div>`;
    if(!rows.length){$("#quotaProgressBody").innerHTML=`<tr><td colspan="9"><div class="empty-state">${unlimitedRole?"当前暂无角色嘉宾报名数据":"点击“调整听众名额”建立报名目标后即可统计"}</div></td></tr>`;return;}
    const detailRow=row=>{if(unlimitedRole)return`<tr><td><strong>${escapeHtml(row.venue)}</strong></td><td>${escapeHtml(row.region)}</td><td>${escapeHtml(row.role)}</td><td>${internal?"不适用":"不限"}</td><td>${row.actual}</td><td>—</td><td>—</td><td>—</td><td><span class="quota-status unlimited">实际统计</span></td></tr>`;if(!quotaConfigured)return`<tr><td><strong>${escapeHtml(row.venue)}</strong></td><td>${escapeHtml(row.region)}</td><td>${escapeHtml(row.role)}</td><td>—</td><td>${row.actual}</td><td>—</td><td>—</td><td>—</td><td><span class="quota-status neutral">未配置名额</span></td></tr>`;const[stateClass,label]=quotaState(row);return`<tr><td><strong>${escapeHtml(row.venue)}</strong></td><td>${escapeHtml(row.region)}</td><td>${escapeHtml(row.role)}</td><td>${row.quota}</td><td>${row.actual}</td><td><b class="quota-gap ${stateClass}">${row.gap>0?"+":""}${row.gap}</b></td><td>${row.remaining}</td><td><div class="quota-rate"><span>${row.percent.toFixed(1)}%</span><i><b class="${stateClass}" style="width:${Math.min(row.percent,100)}%"></b></i></div></td><td><span class="quota-status ${stateClass}">${label}</span></td></tr>`;};
    const summaryRow=(venue,list,grand=false)=>{const firstCells=`<td><strong>${escapeHtml(venue)}</strong></td><td>${grand?"全部大区":"小计"}</td><td>${escapeHtml(activeQuotaRole)}</td>`;const subtotalQuota=list.reduce((sum,row)=>sum+row.quota,0);const subtotalActual=list.reduce((sum,row)=>sum+row.actual,0);if(unlimitedRole)return`<tr class="${grand?"quota-grand-total":"quota-subtotal"}">${firstCells}<td>${internal?"不适用":"不限"}</td><td>${subtotalActual}</td><td>—</td><td>—</td><td>—</td><td><span class="quota-status unlimited">实际统计</span></td></tr>`;if(!quotaConfigured)return`<tr class="${grand?"quota-grand-total":"quota-subtotal"}">${firstCells}<td>—</td><td>${subtotalActual}</td><td>—</td><td>—</td><td>—</td><td><span class="quota-status neutral">名单直连</span></td></tr>`;const subtotalGap=subtotalActual-subtotalQuota;const subtotalRemaining=Math.max(subtotalQuota-subtotalActual,0);const subtotalPercent=subtotalQuota?subtotalActual/subtotalQuota*100:0;const[stateClass,statusLabel]=quotaState({gap:subtotalGap,quota:subtotalQuota});return`<tr class="${grand?"quota-grand-total":"quota-subtotal"}">${firstCells}<td>${subtotalQuota}</td><td>${subtotalActual}</td><td><b class="quota-gap ${stateClass}">${subtotalGap>0?"+":""}${subtotalGap}</b></td><td>${subtotalRemaining}</td><td><strong>${subtotalPercent.toFixed(1)}%</strong></td><td><span class="quota-status ${stateClass}">${statusLabel}</span></td></tr>`;};
    const ordered=[...rows].sort((a,b)=>a.venue.localeCompare(b.venue,"zh-CN")||a.region.localeCompare(b.region,"zh-CN")||a.role.localeCompare(b.role,"zh-CN"));const venues=[...new Set(ordered.map(row=>row.venue))];
    $("#quotaProgressBody").innerHTML=venues.map(venue=>{const list=ordered.filter(row=>row.venue===venue);return list.map(detailRow).join("")+summaryRow(venue,list);}).join("")+summaryRow("全部会场",ordered,true);
  }

  function quotaConfigOptions(key,value) { const configured=state.settings.registrationQuotas||[];const source=key==="venue"?[...(state.settings.venues||[]).map(normalizeVenueLabel),...configured.map(item=>normalizeVenueLabel(item.venue)),...activeVisibleAttendees().map(item=>normalizeVenueLabel(item.venue))]:key==="role"?["听众"]:[...configured.map(item=>normalizeQuotaRegion(item.region)),...activeVisibleAttendees().map(item=>normalizeQuotaRegion(item.region))];const options=[...new Set(source.filter(Boolean))];if(key!=="role"&&value&&!options.includes(value))options.unshift(value);return options.map(option=>`<option value="${escapeHtml(option)}" ${option===value?"selected":""}>${escapeHtml(option)}</option>`).join(""); }
  const parseQuotaRegions = value => String(value||"").split(/[、,，\n]+/).map(item=>item.trim()).filter(Boolean);
  function quotaRegionChoices(extra=[]) { const configured=normalizedQuotaConfiguration();return[...new Set([...extra,...(state.settings.quotaRegions||[]),...configured.map(item=>normalizeQuotaRegion(item.region))].map(value=>String(value||"").trim()).filter(Boolean))]; }
  function renderQuotaRegionOptions(extra=[]) { $("#quotaRegionOptions").innerHTML=quotaRegionChoices(extra).map(region=>`<option value="${escapeHtml(region)}"></option>`).join(""); }
  function appendQuotaConfigRow(item={venue:normalizeVenueLabel(state.settings.venues?.[0])||normalizeVenueLabel(activeVisibleAttendees()[0]?.venue)||"",region:state.settings.quotaRegions?.[0]||normalizeQuotaRegion(activeVisibleAttendees()[0]?.region),role:"听众",quota:0}) { const row=document.createElement("div");row.className="quota-config-row";row.innerHTML=`<select name="quotaVenue" aria-label="会场">${quotaConfigOptions("venue",normalizeVenueLabel(item.venue))}</select><input name="quotaRegion" list="quotaRegionOptions" value="${escapeHtml(normalizeQuotaRegion(item.region))}" placeholder="选择或输入大区" aria-label="大区"/><select name="quotaRole" aria-label="角色">${quotaConfigOptions("role","听众")}</select><input name="quotaValue" type="number" min="0" step="1" value="${quotaNumber(item.quota)}" aria-label="分配名额"/><button type="button" class="quota-remove-row">删除</button>`;row.querySelector(".quota-remove-row").onclick=()=>row.remove();$("#quotaConfigRows").append(row); }
  function openQuotaConfiguration() { if(!canManage())return deny();if(state.settings.activityType==="internal")return toast("内部会议不启用会场、大区听众名额配置","error");$("#quotaRegionPresets").value=(state.settings.quotaRegions||[]).join("、");renderQuotaRegionOptions();$("#quotaConfigRows").innerHTML="";normalizedQuotaConfiguration().forEach(appendQuotaConfigRow);if(!$("#quotaConfigRows").children.length)appendQuotaConfigRow();$("#quotaFormError").textContent="";$("#quotaDialog").showModal(); }
  async function saveQuotaConfiguration(event) { event.preventDefault();if(!canManage())return deny();const button=event.currentTarget.querySelector('button[type="submit"]');const rows=$$(".quota-config-row",event.currentTarget).map(row=>({venue:normalizeVenueLabel(row.querySelector('[name="quotaVenue"]').value),region:normalizeQuotaRegion(row.querySelector('[name="quotaRegion"]').value),role:normalizeQuotaRole(row.querySelector('[name="quotaRole"]').value),quota:quotaNumber(row.querySelector('[name="quotaValue"]').value)}));const seen=new Set();if(rows.some(row=>!row.venue||!row.region||!row.role))return $("#quotaFormError").textContent="请完整填写每一行名额配置";if(rows.some(row=>{const key=quotaKey(row.venue,row.region,row.role);if(seen.has(key))return true;seen.add(key);return false;}))return $("#quotaFormError").textContent="同一会场、大区和角色不能重复配置";const presets=parseQuotaRegions($("#quotaRegionPresets").value);const quotaRegions=[...new Set([...presets,...rows.map(row=>row.region)])];button.disabled=true;try{await persistMeetingSettings({field_config:{registrationQuotas:rows,quotaRegions}});state.settings.registrationQuotas=rows;state.settings.quotaRegions=quotaRegions;state.settings.fieldConfig={...state.settings.fieldConfig,registrationQuotas:rows,quotaRegions};addNotification("change",`${currentUser().name}更新了报名名额配置，共${rows.length}项、大区${quotaRegions.length}个`);persistStateLocally();$("#quotaDialog").close();renderAll();toast("名额与大区配置已保存，报名进度已重新统计");}catch(error){if(settingsConflict(error)){await loadBackendState(backendMeetingId);renderAll();$("#quotaDialog").close();toast("名额配置已被其他页面更新，已加载最新内容","error");}else $("#quotaFormError").textContent=error.message||"名额保存失败";}finally{button.disabled=false;} }

  function renderDashboard() {
    const list = activeVisibleAttendees(); const pending = list.filter(a => a.approval === "pending").length+list.filter(a=>roomingApprovalStatus(a)==="pending").length;
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
    const baseColumns=(state.settings.registrationTemplate?.columns?.length?state.settings.registrationTemplate:standardTemplate()).columns.filter(column=>column.key!=="sequence");
    const baseKeys=new Set(baseColumns.map(column=>column.key));const templateColumns=[...baseColumns,...JOURNEY_FORM_COLUMNS.filter(column=>!baseKeys.has(column.key))];
    return visibleAttendees().filter(a => {
      const haystack = [a.name,a.city,a.hospital,a.department,a.outNo,a.returnNo,a.departCity,a.departStation,a.arriveCity,a.arriveStation,...(a.customFields?._journeySegments||[]).flatMap(item=>[item.departCity,item.departStation,item.arriveCity,item.arriveStation,item.number])].join(" ").toLowerCase();
      const hasMissing=templateColumns.some(column=>{const value=column.custom?a.customFields?.[column.key]:a[column.key];return value===null||value===undefined||String(value).trim()==="";});
      const matchesArchive=cancelledRosterView?a.businessStatus==="cancelled":a.businessStatus!=="cancelled";
      return matchesArchive && (!query || haystack.includes(query)) && (risk === "all" || a.approval === risk) && (venue === "all" || normalizeVenueLabel(a.venue) === venue) && (!incompleteRosterOnly||hasMissing);
    });
  }
  function syncRosterVenueFilter(){const select=$("#venueFilter");const previous=normalizeVenueLabel(select.value)||"all";const scoped=visibleAttendees().filter(a=>cancelledRosterView?a.businessStatus==="cancelled":a.businessStatus!=="cancelled");const actual=[...new Set(scoped.map(a=>normalizeVenueLabel(a.venue)).filter(Boolean))];const fallback=(state.settings.venues||[]).map(normalizeVenueLabel).filter(Boolean);const values=[...new Set(actual.length?actual:fallback)].sort((a,b)=>a.localeCompare(b,"zh-CN"));select.innerHTML=`<option value="all">全部会场</option>${values.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;select.value=values.includes(previous)?previous:"all";}
  function extraJourneySummary(attendee){const counts={outbound:1,return:1};return(attendee.customFields?._journeySegments||[]).map(item=>{const direction=item.direction==="return"?"return":"outbound";counts[direction]+=1;return`${direction==="return"?"返程":"去程"}${counts[direction]}：${item.number||"未填写"} ${item.departCity||"—"}→${item.arriveCity||"—"}`;}).join("；");}
  function rosterSupplementalColumns(list,templateColumns){
    const existing=new Set(templateColumns.map(column=>column.key));
    const definitions=[
      {key:"_journeySegments",header:"新增多段行程",value:extraJourneySummary,has:attendee=>(attendee.customFields?._journeySegments||[]).length>0},
      {key:"outboundTransferOrigin",header:"去程属地送站出发地点",value:attendee=>attendee.outboundTransferOrigin||""},
      {key:"outboundTransferTime",header:"去程属地预约送站时间",value:attendee=>attendee.outboundTransferTime||""},
      {key:"outboundTransferNotes",header:"去程属地送站备注",value:attendee=>attendee.outboundTransferNotes||""},
      {key:"returnTransferDestination",header:"返程属地接站送达目的地",value:attendee=>attendee.returnTransferDestination||""},
      {key:"returnTransferTime",header:"返程属地预估接站时间",value:attendee=>attendee.returnTransferTime||""},
      {key:"returnTransferNotes",header:"返程属地接站备注",value:attendee=>attendee.returnTransferNotes||""},
    ];
    return definitions.filter(column=>!existing.has(column.key)&&list.some(attendee=>column.has?column.has(attendee):String(column.value(attendee)||"").trim()!==""));
  }
  function renderAttendeeTable() {
    syncRosterVenueFilter();
    const list = getFilteredAttendees();
    const templateColumns=meetingTemplateColumns();
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
    const templateValue=(attendee,column,index)=>{if(column.key==="sequence")return String(index+1);if(column.key==="contactName")return attendee.contactName||"";if(column.key==="contactMobile")return attendee.contactMobile||"";if(column.key==="venue")return normalizeVenueLabel(attendee.venue);if(/TransportType$/.test(column.key))return TravelFields.TYPES[attendee[column.key]]||attendee[column.key]||"";if(/Station$/.test(column.key))return TravelFields.displayStation(attendee[column.key],attendee[column.key.replace("Station","TransportType")],stationDictionary());return column.custom?attendee.customFields?.[column.key]??"":attendee[column.key]??"";};
    const templateCell=(attendee,column,index)=>{const raw=templateValue(attendee,column,index);const empty=raw===null||raw===undefined||String(raw).trim()==="";const phoneSensitive=["phone","contactMobile"].includes(column.key);const idSensitive=["idNumber","employeeNo"].includes(column.key);const display=empty?"未填写":phoneSensitive?maskPhone(raw):idSensitive?maskIdentifier(raw):String(raw);const verified=TravelVerification.verifiedField(attendee,column.key);const validation=identityDataValidation(attendee),invalid=validation.fields.has(column.key),validationText=(validation.messages[column.key]||[]).join("；");return `<td class="template-data-cell ${verified?"travel-verified-cell":""} ${invalid?"identity-invalid-cell":""}" data-template-key="${escapeHtml(column.key||"")}" title="${escapeHtml(invalid?validationText:display)}"><span class="${empty?"template-empty":""}">${escapeHtml(display)}</span>${invalid?'<small class="identity-invalid-label">⚠ 需核对</small>':verified?'<small class="travel-verified-label">✓ 已核验</small>':""}</td>`;};
    const supplementalColumns=rosterSupplementalColumns(list,templateColumns);
    const selectable=list.filter(a=>a.businessStatus!=="cancelled"&&!isLocked(a)&&canEditAttendeeData()&&(currentUser().role!=="sales"||a.ownerId===currentUser().id));
    const allSelected=selectable.length>0&&selectable.every(a=>selectedAttendeeIds.has(a.id));
    $("#attendeeTableHead").innerHTML=`<th class="roster-check-cell"><input id="selectVisibleAttendees" type="checkbox" aria-label="全选当前名单" ${allSelected?"checked":""} ${selectable.length?"":"disabled"}></th>${templateColumns.map(column=>`<th data-template-key="${escapeHtml(column.key||"")}">${templateHeader(column)}</th>`).join("")}${supplementalColumns.map(column=>`<th data-supplemental-key="${column.key}">${column.header}</th>`).join("")}<th>报名状态</th><th>隐私沟通函</th><th>出票状态</th><th>负责人</th><th>行程审批</th><th>操作</th>`;
    $("#attendeeTableBody").innerHTML = list.map((a,index) => {const selectableRow=a.businessStatus!=="cancelled"&&!isLocked(a)&&canEditAttendeeData()&&(currentUser().role!=="sales"||a.ownerId===currentUser().id);const supplementalCell=column=>{const value=column.value(a);return`<td class="template-data-cell"><span class="${value?"":"template-empty"}">${escapeHtml(value||"未填写")}</span></td>`;};return `<tr class="${a.businessStatus==="cancelled"?"cancelled-row":""}"><td class="roster-check-cell"><input type="checkbox" data-select-attendee="${a.id}" aria-label="选择${escapeHtml(a.name)}" ${selectedAttendeeIds.has(a.id)?"checked":""} ${selectableRow?"":"disabled"}></td>${templateColumns.map(column=>templateCell(a,column,index)).join("")}${supplementalColumns.map(supplementalCell).join("")}<td><span class="status ${a.businessStatus==="cancelled"?"status-pending":"status-normal"}">${a.businessStatus==="cancelled"?"已取消报名":"有效报名"}</span></td><td>${privacyControl(a)}</td><td>${progressSelect(a,"ticketStatus",[["pending","待出票"],["processing","出票中"],["ticketed","已出票"],["changed","改签"],["refunded","已退票"]])}</td><td>${escapeHtml(userName(a.ownerId))}</td><td><div class="approval-status-stack">${segmentBadge(a,"outbound","去程")}${segmentBadge(a,"return","返程")}</div></td><td><button class="row-action" data-open-attendee="${a.id}" aria-label="查看详情">•••</button></td></tr>`;}).join("");
    $("#selectVisibleAttendees").onchange=event=>{selectable.forEach(a=>event.target.checked?selectedAttendeeIds.add(a.id):selectedAttendeeIds.delete(a.id));renderAttendeeTable();};
    $$('[data-select-attendee]').forEach(input=>input.onchange=()=>{input.checked?selectedAttendeeIds.add(input.dataset.selectAttendee):selectedAttendeeIds.delete(input.dataset.selectAttendee);updateSelectedAttendeeControls();});
    $$('[data-progress-field]').forEach(select=>select.onchange=()=>updateProgressField(select));
    $$('[data-upload-privacy-letter]').forEach(button=>button.onclick=()=>requestPrivacyLetterUpload(state.attendees.find(item=>item.id===button.dataset.uploadPrivacyLetter)));
    $$('[data-download-privacy-letter]').forEach(button=>button.onclick=()=>downloadPrivacyLetter(state.attendees.find(item=>item.id===button.dataset.downloadPrivacyLetter)));
    $("#attendeeEmpty").textContent=cancelledRosterView?"暂无已删除或已取消报名人员":"没有符合条件的当前参会人员";$("#attendeeEmpty").classList.toggle("is-hidden", !!list.length); bindDynamicButtons();
    updateSelectedAttendeeControls();
  }

  function updateSelectedAttendeeControls(){for(const id of [...selectedAttendeeIds])if(!state.attendees.some(a=>a.id===id&&a.businessStatus!=="cancelled"))selectedAttendeeIds.delete(id);const count=selectedAttendeeIds.size;$("#selectedAttendeeCount").textContent=count;$("#deleteSelectedAttendees").disabled=!count||!canEditAttendeeData();}

  async function deleteSelectedAttendees(){const attendees=state.attendees.filter(a=>selectedAttendeeIds.has(a.id)&&a.businessStatus!=="cancelled"&&!isLocked(a)&&(currentUser().role!=="sales"||a.ownerId===currentUser().id));if(!attendees.length)return toast("没有可删除的已选名单","error");if(!confirm(`确认删除所选 ${attendees.length} 条报名？记录将标记为“已取消报名”并保留审计历史。`))return;const ids=attendees.map(a=>a.id);try{if(backend){const{error}=await backend.from("attendees").update({business_status:"cancelled",cancelled_at:new Date().toISOString()}).in("id",ids).eq("meeting_id",backendMeetingId);if(error)throw error;}attendees.forEach(a=>{a.businessStatus="cancelled";addNotification("change",`${currentUser().name}取消了${a.name}的报名（仅保留审计，不生成待办）`,{attendeeName:a.name,changes:[{field:"businessStatus",label:"报名状态",before:"有效报名",after:"已取消报名"}],read:true,auditOnly:true});});selectedAttendeeIds.clear();saveState();renderAll();toast(`已删除 ${attendees.length} 条名单，审计记录已保留且不生成提醒待办`);}catch(error){toast(error.message||"删除名单失败","error");}}

  function updateProgressField(select) {
    const a=state.attendees.find(item=>item.id===select.dataset.attendeeId); if(!a||isLocked(a)) return renderAttendeeTable();
    if(!canEditAttendeeData()||(currentUser().role==="sales"&&a.ownerId!==currentUser().id)) return deny();
    const field=select.dataset.progressField; const previous=a[field]||"pending"; const next=select.value; if(previous===next)return;
    if(field==="privacyLetterStatus"&&next==="paper"&&!a.privacyLetterFilePath){select.value=previous;requestPrivacyLetterUpload(a);return;}
    if(field==="ticketStatus"&&["processing","ticketed","changed"].includes(next)) { const blockers=ticketApprovalBlockers(a); if(blockers.length){ select.value=previous; const labels=blockers.map(segment=>segment==="outbound"?"去程":"返程").join("、"); return toast(`${a.name}的${labels}行程尚未审批通过，不能进行出票`,"error"); } }
    const labels={pending:"未完成",electronic:"已完成（隐私沟通函电子版）",paper:"已完成（隐私沟通函纸质版）",processing:"出票中",ticketed:"已出票",changed:"改签",refunded:"已退票"};
    a[field]=next; addNotification("change",`${currentUser().name}变更了${a.name}的${FIELD_LABELS[field]}`,{attendeeName:a.name,changes:[{field,label:FIELD_LABELS[field],before:labels[previous]||previous,after:labels[next]||next}]}); saveState(); renderAll(); toast(`${a.name}的${FIELD_LABELS[field]}已更新`);
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

  const normalizeRoomType=value=>RoomingEngine.normalizeType(value);
  const roomTypeLabel=value=>RoomingEngine.label(value);
  const configuredRoomingRules=()=>RoomingEngine.rulesWithDefaults(state.settings.roomingRules||{});
  function roomingRecord(attendee){return RoomingEngine.record(attendee);}
  function roomingNights(attendee){return RoomingEngine.referenceNights(attendee);}
  function roomingDates(attendee){return RoomingEngine.lodgingDates(attendee);}
  function roomingReferenceDates(attendee){return RoomingEngine.referenceDates(attendee);}
  function suggestedRoomType(attendee){return isInternalMeeting()?"":RoomingEngine.recommendation(attendee,configuredRoomingRules()).type;}
  function roomingSuggestion(attendee){return isInternalMeeting()?{type:"",source:"内部会议由会务人工安排"}:RoomingEngine.recommendation(attendee,configuredRoomingRules());}
  function roomingConflict(attendee){if(isInternalMeeting())return false;const room=roomingRecord(attendee);return room.requestedType&&room.requestedType!=="none"&&room.requestedType!==suggestedRoomType(attendee);}
  function roomingApprovalStatus(attendee){if(isInternalMeeting())return"normal";const room=roomingRecord(attendee),eligible=(configuredRoomingRules().singleTitles||[]).includes(attendee.title),singleException=room.requestedType==="single"&&(!eligible||room.exceptionRequested===true);if(!(state.settings.roomingRules?.conflictApproval&&singleException))return"normal";return room.approvalStatus==="approved"?"approved":room.approvalStatus==="rejected"?"rejected":"pending";}
  function roomingStatistics(attendees=activeVisibleAttendees()){
    const records=attendees.map(attendee=>({attendee,room:roomingRecord(attendee)}));
    const effectiveType=({attendee,room})=>room.assignedType||(attendee.accommodation==="N"?"none":"");
    const noStay=records.filter(item=>effectiveType(item)==="none");
    const staying=records.filter(item=>effectiveType(item)!=="none"&&(item.attendee.accommodation==="Y"||["single","shared","twin_single"].includes(effectiveType(item))));
    const count=type=>staying.filter(item=>effectiveType(item)===type).length;
    return{totalStay:staying.length,noStay:noStay.length,single:count("single"),shared:count("shared"),twinSingle:count("twin_single"),unassigned:staying.filter(item=>!effectiveType(item)).length,actualNights:staying.reduce((sum,item)=>sum+(Number(item.room.actualNights)||0),0),staying:staying.map(item=>item.attendee)};
  }
  function materializeRoomingFinalDates(attendees=activeVisibleAttendees()){
    let changed=0;
    attendees.forEach(attendee=>{
      const room=roomingRecord(attendee);
      if(attendee.accommodation==="N"||room.assignedType==="none"||!["single","shared","twin_single"].includes(room.assignedType))return;
      const displayed=roomingDates(attendee),patch={};
      // The UI has always prefilled lodging dates from travel. Persist those initial
      // defaults into the final rooming record so the table never shows values that
      // the occupancy engine cannot read. Later travel edits do not overwrite them.
      if(!room.checkInDate&&displayed.checkIn)patch.checkInDate=displayed.checkIn;
      if(!room.checkOutDate&&displayed.checkOut)patch.checkOutDate=displayed.checkOut;
      if(!Object.keys(patch).length)return;
      attendee.customFields={...(attendee.customFields||{}),_rooming:{...room,...patch,dateDefaultsInitializedAt:room.dateDefaultsInitializedAt||new Date().toISOString()}};
      changed+=1;
    });
    return changed;
  }
  function roomingOccupancyData(){return RoomingEngine.dailyOccupancy(activeVisibleAttendees(),{from:$("#roomingOccupancyFrom")?.value||"",to:$("#roomingOccupancyTo")?.value||""});}
  function roomingOccupancyDateLabel(date){return`${date} ${new Intl.DateTimeFormat("zh-CN",{weekday:"short"}).format(new Date(`${date}T00:00:00`))}`;}
  function roomingOccupancyRows(data=roomingOccupancyData()){return[["住宿日期","单间","标间单住","标间拼住","房间总数"],...data.rows.map(row=>[roomingOccupancyDateLabel(row.date),row.single,row.twinSingle,row.shared,row.single+row.twinSingle+row.shared])];}
  function roomingOccupancySheet(data=roomingOccupancyData()){
    const sheet=XLSX.utils.aoa_to_sheet(roomingOccupancyRows(data));sheet["!cols"]=[{wch:22},{wch:14},{wch:16},{wch:16},{wch:16}];return sheet;
  }
  function renderRoomingOccupancy(){
    const data=roomingOccupancyData(),totalRoomNights=data.rows.reduce((sum,row)=>sum+row.single+row.shared+row.twinSingle,0),from=$("#roomingOccupancyFrom"),to=$("#roomingOccupancyTo");
    if(data.sourceFrom){from.min=data.sourceFrom;to.min=data.sourceFrom;from.max=data.sourceTo;to.max=data.sourceTo;}else{from.removeAttribute("min");from.removeAttribute("max");to.removeAttribute("min");to.removeAttribute("max");}
    $("#roomingOccupancySummary").innerHTML=data.rows.length?`<span><strong>${escapeHtml(data.from)} 至 ${escapeHtml(data.to)}</strong> · 共 ${data.rows.length} 个住宿自然日</span><span>当前筛选合计 <strong>${totalRoomNights}</strong> 间夜 · 标间包含单住与已完成拼住的房间</span>`:`<span><strong>暂无可统计数据</strong> · 请完整确认实际房型和最终入住、退房日期</span><span>无需住宿、待分配及未完成拼房人员不计入</span>`;
    $("#roomingOccupancyBody").innerHTML=data.rows.length?data.rows.map(row=>{const twin=row.twinSingle+row.shared;return`<tr><td>${escapeHtml(roomingOccupancyDateLabel(row.date))}</td><td>${row.single}</td><td>${twin}</td><td class="rooming-day-total">${row.single+twin}</td></tr>`;}).join(""):`<tr><td class="rooming-occupancy-empty" colspan="4">当前日期范围内暂无已完成的住宿安排</td></tr>`;
  }
  async function exportRoomingOccupancy(){if(isReadOnlyStaff())return toast("只读账号没有数据导出权限","error");if(!window.XLSX)return toast("Excel 组件尚未加载，请刷新后重试","error");const data=roomingOccupancyData();if(!data.rows.length)return toast("当前日期范围内没有可导出的分房数据","error");const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,roomingOccupancySheet(data),"分房统计");try{await writeStyledWorkbook(wb,`${state.settings.slug||"项目"}-分房统计-${data.from}-${data.to}.xlsx`);toast("分房统计已按统一格式导出");}catch(error){toast(`导出失败：${error.message}`,"error");}}

  function renderApprovals() {
    const list = activeVisibleAttendees().filter(a => ["outbound","return"].some(segment=>["pending","rejected"].includes(segmentApproval(a,segment))));
    const roomList=activeVisibleAttendees().filter(a=>["pending","rejected"].includes(roomingApprovalStatus(a)));
    const rules=state.settings.travelApprovalRules||{};
    const segmentRow=(a,segment)=>{ const outbound=segment==="outbound"; const status=segmentApproval(a,segment); const risks=evaluateSegmentRisks(a)[segment]; if(status==="normal")return""; const threshold=outbound?`允许最早抵达：${rules.earliestArrival||rules.arrivalStart||"未设置"}`:`允许最晚撤离：${rules.latestDeparture||rules.returnEnd||"未设置"}`;return `<div class="segment-approval-row"><div><span class="segment-status ${status}">${outbound?"去程":"返程"} · ${status==="approved"?"已审批":status==="rejected"?"已驳回":"待审批"}</span><strong>${escapeHtml(outbound?`${a.departCity||a.outFrom} → ${a.arriveCity||a.outTo} · ${a.outNo}`:`${a.returnDepartCity||a.returnFrom} → ${a.returnArriveCity||a.returnTo} · ${a.returnNo}`)}</strong><small>触发原因：${risks.map(escapeHtml).join("；")}</small><small>会议规则：${escapeHtml(threshold)}；城市一致性校验${rules.mismatchEnabled!==false?"已开启":"已关闭"}</small></div><div class="segment-actions three-actions"><button class="button button-secondary" data-travel-decision="returned" data-attendee="${a.id}" data-segment="${segment}" ${canEditAttendeeData()?"":"disabled"}>退回修改</button><button class="button button-ghost" data-travel-decision="rejected" data-attendee="${a.id}" data-segment="${segment}" ${canEditAttendeeData()?"":"disabled"}>驳回</button><button class="button button-primary" data-travel-decision="approved" data-attendee="${a.id}" data-segment="${segment}" ${canEditAttendeeData()?"":"disabled"}>通过</button></div></div>`; };
    const travelCards=list.map(a=>`<article class="panel approval-card segment-approval-card"><span class="status status-pending">行程合规审批</span><h3>${escapeHtml(a.name)}</h3><div class="approval-meta">${escapeHtml(a.hospital)} · 负责人 ${escapeHtml(userName(a.ownerId))}</div><div class="segment-approval-list">${segmentRow(a,"outbound")}${segmentRow(a,"return")}</div></article>`).join("");
    const roomCards=roomList.map(a=>{const room=roomingRecord(a);return`<article class="panel approval-card rooming-approval-card"><span class="status status-pending">住宿单间例外审批</span><h3>${escapeHtml(a.name)}</h3><div class="approval-meta">${escapeHtml(a.title||"职称未填写")} · ${escapeHtml(a.hospital||"单位未填写")} · ${escapeHtml(a.region||"大区未填写")}</div><div class="approval-reason">触发原因：${escapeHtml(room.exceptionRequested?"已标记特殊单间需求":"非副高及以上职称申请单间")}</div><div class="rooming-approval-compare"><div><small>申请房型</small><strong>${roomTypeLabel(room.requestedType)}</strong></div><div><small>基础规则</small><strong>主任医师 / 副主任医师可单间，其余标间拼住</strong></div></div><div class="segment-actions"><button class="button button-secondary" data-room-decision="rejected" data-attendee="${a.id}">驳回</button><button class="button button-primary" data-room-decision="approved" data-attendee="${a.id}">通过</button></div></article>`;}).join("");
    $("#approvalBoard").innerHTML = travelCards+roomCards || `<article class="panel empty-state" style="grid-column:1/-1">当前没有行程或住宿审批待办</article>`;
    bindDynamicButtons();
  }

  function saveRooming(attendee,changes,message) {
    const before=roomingRecord(attendee);attendee.customFields={...(attendee.customFields||{}),_rooming:{...before,...changes,updatedAt:new Date().toISOString(),updatedBy:state.currentUserId}};
    const labels={requestedType:"申请房型",assignedType:"实际房型",roommateId:"拼住室友",roomNumber:"房号",checkInDate:"入住日期",checkOutDate:"退房日期",actualNights:"实际允许住宿间夜数",approvalStatus:"住宿审批",approvalNote:"审批说明"};const detail=Object.keys(changes).filter(key=>JSON.stringify(before[key])!==JSON.stringify(changes[key])).map(key=>({field:`rooming.${key}`,label:labels[key]||key,before:key==="roommateId"?(state.attendees.find(item=>item.id===before[key])?.name||"未匹配"):before[key]||"未填写",after:key==="roommateId"?(state.attendees.find(item=>item.id===changes[key])?.name||"未匹配"):changes[key]||"未填写"}));
    addNotification("change",`${currentUser().name}更新了${attendee.name}的分房信息：${message}`,{attendeeName:attendee.name,changes:detail});saveState();renderAll();
  }
  function updateRoomingField(id,field,value) {
    if(!canManage())return deny();const attendee=state.attendees.find(item=>item.id===id);if(!attendee||attendee.businessStatus==="cancelled")return;if(isFieldLocked(attendee,"accommodation"))return toast("住宿整列或该参会者已锁定","error");
    const previous=roomingRecord(attendee),manualFields=[...new Set([...(previous.manualFields||[]),field])],next={manualFields};
    next[field]=field==="assignedType"?normalizeRoomType(value):field==="actualNights"?(value===""?"":Math.max(0,Math.trunc(Number(value)||0))):value;
    if(field==="assignedType"){
      next.assignmentSource="manual";next.approvalStatus=roomingConflict(attendee)?"pending":"normal";
      if(next.assignedType!=="shared"){const oldMate=state.attendees.find(item=>item.id===previous.roommateId);if(oldMate){const oldRoom=roomingRecord(oldMate);oldMate.customFields={...(oldMate.customFields||{}),_rooming:{...oldRoom,roommateId:"",roommateSource:"manual",pairingReason:"",pendingManual:oldRoom.assignedType==="shared",manualFields:[...new Set([...(oldRoom.manualFields||[]),"roommateId"])]}};}next.roommateId="";next.roommateSource="";next.pairingReason="";next.pendingManual=false;}
      else next.pendingManual=next.assignedType==="shared"&&!previous.roommateId;
    }
    if(field==="roommateId"){
      const oldMate=state.attendees.find(item=>item.id===previous.roommateId);if(oldMate){const oldRoom=roomingRecord(oldMate);oldMate.customFields={...(oldMate.customFields||{}),_rooming:{...oldRoom,roommateId:"",roommateSource:"manual",pairingReason:"",pendingManual:oldRoom.assignedType==="shared",manualFields:[...new Set([...(oldRoom.manualFields||[]),"roommateId"])]}};}
      const mate=state.attendees.find(item=>item.id===value);if(mate){const mateRoom=roomingRecord(mate);mate.customFields={...(mate.customFields||{}),_rooming:{...mateRoom,roommateId:attendee.id,assignedType:"shared",roommateSource:"manual",pairingReason:"人工指定",pendingManual:false,manualFields:[...new Set([...(mateRoom.manualFields||[]),"assignedType","roommateId"])]}};}
      Object.assign(next,{roommateSource:"manual",pairingReason:value?"人工指定":"",pendingManual:!value&&previous.assignedType==="shared"});
    }
    const fieldLabel={assignedType:"实际房型",roommateId:"拼住室友",checkInDate:"入住日期",checkOutDate:"退房日期",actualNights:"实际允许住宿间夜",roomNumber:"房号"}[field]||field;
    saveRooming(attendee,next,`${fieldLabel}：${field==="roommateId"?(state.attendees.find(item=>item.id===value)?.name||"取消匹配"):field==="assignedType"?roomTypeLabel(next[field]):next[field]||"空"}`);
  }
  function renderRooming() {
    $("#applyRoomingSuggestions").disabled=!canManage()||isInternalMeeting();$("#applyRoomingSuggestions").title=isInternalMeeting()?"内部会议采用人工分房，不执行外部会议自动规则":canManage()?"按当前项目规则重跑，保留全部人工设置":"仅管理员和会务负责人可以执行自动分房";
    const query=$("#roomingSearch")?.value.trim().toLowerCase()||"";const filter=$("#roomingStatusFilter")?.value||"all";const all=activeVisibleAttendees();
    const initializedDates=materializeRoomingFinalDates(all);if(initializedDates&&canManage())saveState();
    renderRoomingOccupancy();
    const staying=all.filter(a=>a.accommodation==="Y"||roomingRecord(a).requestedType||roomingRecord(a).assignedType);const conflicts=staying.filter(roomingConflict);const pendingApproval=staying.filter(a=>roomingApprovalStatus(a)==="pending");const pendingManual=staying.filter(a=>{const room=roomingRecord(a);return room.assignedType==="shared"&&!room.roommateId;});
    const list=staying.filter(a=>{const room=roomingRecord(a);const status=roomingApprovalStatus(a);const haystack=[a.name,a.region,a.city,RoomingEngine.province(a),a.hospital,room.roomNumber].join(" ").toLowerCase();const matches=filter==="all"||(filter==="pending"&&room.assignedType==="shared"&&!room.roommateId)||(filter==="conflict"&&roomingConflict(a))||(filter==="approval"&&status==="pending")||(filter==="done"&&!!room.assignedType&&(room.assignedType!=="shared"||!!room.roommateId));return(!query||haystack.includes(query))&&matches;});
    $("#roomingTableBody").innerHTML=list.length?list.map(a=>{const room=roomingRecord(a),suggestion=roomingSuggestion(a),dates=roomingDates(a),reference=roomingReferenceDates(a),dateIssue=RoomingEngine.lodgingDateIssue(a),conflict=roomingConflict(a),assigned=room.assignedType||(a.accommodation==="N"?"none":""),locked=isFieldLocked(a,"accommodation"),manual=new Set(room.manualFields||[]);const candidates=all.filter(other=>other.id!==a.id&&(roomingRecord(other).assignedType||suggestedRoomType(other))==="shared");const approval=roomingApprovalStatus(a),needsManual=assigned==="shared"&&!room.roommateId;return`<tr class="${conflict?"rooming-conflict-row":""} ${locked?"locked-row":""} ${needsManual?"rooming-pending-row":""}"><td><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.venue||"会场未填写")}${locked?" · 已锁定":""}</small></td><td><strong>${escapeHtml(a.sex||"未填写")}</strong></td><td>${escapeHtml(a.region||"—")}<small>${escapeHtml(a.city||"城市未填写")} · ${escapeHtml(RoomingEngine.province(a)||"省份未填写")}</small></td><td>${escapeHtml(a.hospital||"—")}<small>${escapeHtml(a.title||"职称未填写")}</small></td><td>${escapeHtml(reference.arrival||"—")}<small>撤离 ${escapeHtml(reference.departure||"—")} · 行程参考 ${RoomingEngine.travelReferenceNights(a)} 间夜</small></td><td><div class="rooming-stay-editor"><label><span>入住</span><input class="${manual.has("checkInDate")?"manual-value":""}" data-room-field="checkInDate" data-attendee="${a.id}" type="date" value="${escapeHtml(dates.checkIn)}" ${canManage()&&!locked?"":"disabled"}></label><label><span>退房</span><input class="${manual.has("checkOutDate")?"manual-value":""}" data-room-field="checkOutDate" data-attendee="${a.id}" type="date" value="${escapeHtml(dates.checkOut)}" ${canManage()&&!locked?"":"disabled"}></label><label><span>实际间夜</span><input class="rooming-night-input ${manual.has("actualNights")?"manual-value":""}" data-room-field="actualNights" data-attendee="${a.id}" type="number" min="0" step="1" value="${room.actualNights}" placeholder="人工填写" ${canManage()&&!locked?"":"disabled"}></label><small class="${dateIssue?"rooming-date-warning":""}">${dateIssue?escapeHtml(dateIssue):`住宿日期推算 ${roomingNights(a)} 间夜，仅供校验`}</small></div></td><td>${roomTypeLabel(room.requestedType)}</td><td><span class="room-suggestion ${conflict?"conflict":""}">${roomTypeLabel(suggestion.type)}${conflict?" △":""}</span><small>${escapeHtml(suggestion.source)}</small></td><td><select class="${manual.has("assignedType")?"manual-value":""}" data-room-field="assignedType" data-attendee="${a.id}" ${canManage()&&!locked?"":"disabled"}><option value="">待安排</option><option value="single" ${assigned==="single"?"selected":""}>单间</option><option value="shared" ${assigned==="shared"?"selected":""}>标间拼住</option><option value="twin_single" ${assigned==="twin_single"?"selected":""}>标间单住</option><option value="none" ${assigned==="none"?"selected":""}>无需住宿</option></select><small>${room.assignmentSource==="manual"?"人工设置":escapeHtml(room.assignmentSource||"尚未执行规则")}</small></td><td><select class="${manual.has("roommateId")?"manual-value":""}" data-room-field="roommateId" data-attendee="${a.id}" ${assigned!=="shared"||!canManage()||locked?"disabled":""}><option value="">待匹配</option>${candidates.map(other=>`<option value="${other.id}" ${room.roommateId===other.id?"selected":""}>${escapeHtml(other.name)} · ${escapeHtml(other.sex||"性别未填")}</option>`).join("")}</select><small>${needsManual?'<span class="rooming-pending-badge">待人工安排</span>':escapeHtml(room.pairingReason||"—")}</small></td><td><input class="${manual.has("roomNumber")?"manual-value":""}" data-room-field="roomNumber" data-attendee="${a.id}" value="${escapeHtml(room.roomNumber)}" placeholder="待定" ${canManage()&&!locked?"":"disabled"}></td><td>${needsManual?'<span class="segment-status rejected">待人工安排</span>':`<span class="segment-status ${approval}">${approval==="pending"?"待审批":approval==="approved"?"已批准":approval==="rejected"?"已退回":"已安排"}</span>`}</td></tr>`;}).join(""):`<tr><td colspan="12"><div class="empty-state">没有符合条件的分房记录</div></td></tr>`;
    const roomingTable=$("#roomingTableBody")?.closest("table"),roomingHeaders=roomingTable?.tHead?.rows?.[0]?.cells;
    if(roomingHeaders){roomingHeaders[2].textContent=isInternalMeeting()?"大区 / BU":"大区 / 城市";roomingHeaders[3].textContent=isInternalMeeting()?"职位 / 员工号":"医院 / 职称";}
    if(isInternalMeeting()&&list.length)list.forEach((attendee,index)=>{const cells=$("#roomingTableBody").rows[index]?.cells;if(!cells)return;cells[2].innerHTML=`${escapeHtml(attendee.region||"—")}<small>${escapeHtml(attendee.customFields?.businessUnit||"BU 未填写")}</small>`;cells[3].innerHTML=`${escapeHtml(attendee.customFields?.internalPosition||"—")}<small>${escapeHtml(attendee.customFields?.employeeNo||"员工号未填写")}</small>`;});
    $$('[data-room-field]').forEach(input=>{const event=input.tagName==="INPUT"?"change":"change";input.addEventListener(event,()=>updateRoomingField(input.dataset.attendee,input.dataset.roomField,input.value));});
  }
  function applyRoomingSuggestions() {
    if(!canManage()) return deny();
    if(isInternalMeeting()) return toast("内部会议采用人工分房，不执行外部会议的职称、医院和地域拼住规则","error");
    const targets=activeVisibleAttendees().filter(a=>!isFieldLocked(a,"accommodation")&&(a.accommodation==="Y"||roomingRecord(a).requestedType||roomingRecord(a).assignedType));
    const patches=RoomingEngine.autoAssign(targets,configuredRoomingRules());
    targets.forEach(a=>{const room=patches.get(String(a.id));if(!room)return;a.customFields={...(a.customFields||{}),_rooming:{...room,approvalStatus:roomingConflict(a)?"pending":"normal",autoRunAt:new Date().toISOString(),autoRunBy:state.currentUserId}};});
    addNotification("change",`${currentUser().name}重新执行了自动分房：处理${targets.length}人，人工设置保持不变`);saveState();renderAll();toast(`自动分房完成：${targets.filter(a=>roomingRecord(a).assignedType==="shared"&&!roomingRecord(a).roommateId).length} 人待人工安排`);
  }
  function decideRoomingApproval(id,decision){if(!canEditAttendeeData())return deny();const attendee=state.attendees.find(item=>item.id===id);if(!attendee)return;const note=decision==="rejected"?prompt("请输入驳回备注"):"批准单间例外申请";if(decision==="rejected"&&!note)return;const patch=decision==="approved"?{approvalStatus:"approved",approvalNote:note,assignedType:"single",assignmentSource:"approval"}:{approvalStatus:"rejected",approvalNote:note,assignedType:"shared",roommateId:"",pendingManual:true,assignmentSource:"approval_rejected"};saveRooming(attendee,patch,`${decision==="approved"?"住宿例外已批准":"住宿申请已驳回并恢复标间拼住"}（${note}）`);toast(decision==="approved"?"住宿例外已批准":"住宿申请已驳回");}
  async function exportRoomingList(){
    if(isReadOnlyStaff())return toast("只读账号没有数据导出权限","error");
    const attendees=activeVisibleAttendees(),stats=roomingStatistics(attendees),occupancy=roomingOccupancyData(),headers=["序号","姓名","性别","大区","省份","城市","医院","职称","会场","入住日期","退房日期","住宿日期推算间夜（参考）","实际允许住宿间夜数","申请房型","系统建议","实际房型","拼住室友","匹配依据","房号","安排状态","住宿审批"];
    const rows=attendees.filter(a=>a.accommodation==="Y"||roomingRecord(a).requestedType||roomingRecord(a).assignedType).map((a,index)=>{const room=roomingRecord(a),dates=roomingDates(a);return[index+1,a.name,a.sex,a.region,RoomingEngine.province(a),a.city,a.hospital,a.title,a.venue,dates.checkIn,dates.checkOut,roomingNights(a),room.actualNights,roomTypeLabel(room.requestedType),roomTypeLabel(suggestedRoomType(a)),roomTypeLabel(room.assignedType),state.attendees.find(item=>item.id===room.roommateId)?.name||"",room.pairingReason||"",room.roomNumber,room.assignedType==="shared"&&!room.roommateId?"待人工安排":"已安排",roomingApprovalStatus(a)==="approved"?"已批准":roomingApprovalStatus(a)==="pending"?"待审批":roomingApprovalStatus(a)==="rejected"?"已退回":"无需审批"]});
    if(!window.XLSX)return toast("Excel 组件尚未加载，请刷新后重试","error");
    const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);ws["!cols"]=headers.map((header,index)=>({wch:[6,7,16,17].includes(index)?24:14}));const statisticsRows=[["住宿统计指标","数量","计数口径"],["总住宿人数",stats.totalStay+stats.noStay,"纳入住宿安排的全部有效参会人员"],["无需住宿人数",stats.noStay,"不计入三种房型数量"],["住宿人数",stats.totalStay,"实际需要住宿的人员"],["单间数量",stats.single,"按实际房型为单间的人员数"],["标间单住数量",stats.twinSingle,"按实际房型为标间单住的人员数"],["标间拼住数量",stats.shared,"按实际房型为标间拼住的人员数"],["实际允许总间夜",stats.actualNights,"汇总实际允许住宿间夜数"]];const statisticsSheet=XLSX.utils.aoa_to_sheet(statisticsRows);statisticsSheet["!cols"]=[{wch:22},{wch:12},{wch:48}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,statisticsSheet,"住宿统计");XLSX.utils.book_append_sheet(wb,roomingOccupancySheet(occupancy),"分房统计");XLSX.utils.book_append_sheet(wb,ws,"Rooming List");try{await writeStyledWorkbook(wb,`${state.settings.slug||"项目"}-Rooming-List.xlsx`);toast("Rooming List、住宿统计与分房统计已按统一格式导出");}catch(error){toast(`导出失败：${error.message}`,"error");}
  }

  function renderTransport() {
    const query = $("#transportSearch").value.trim().toLowerCase();
    const list = activeVisibleAttendees().filter(a => !query || [a.name,a.outNo,a.returnNo,a.transport?.pickup?.batchName,a.transport?.dropoff?.batchName].join(" ").toLowerCase().includes(query));
    renderTransportBatches(list);
    $("#newPickupBatch").classList.toggle("is-hidden",!canManage()); $("#newDropoffBatch").classList.toggle("is-hidden",!canManage()); $("#autoArrangeTransport").classList.toggle("is-hidden",!canManage());$("#exportTransportPlan").classList.toggle("is-hidden",!canManage());
    const cards = [];
    list.forEach(a => {
      ["pickup","dropoff"].forEach(type => {
        if (activeTransportFilter !== "all" && activeTransportFilter !== type) return;
        const item = a.transport?.[type] || {};
        const staff = isStaffTransport(item);
        const assigned = staff || (item.driver && item.driver !== "待分配");
        const contact = staff ? `${item.staffName || "会务工作人员"} · ${item.phone || "—"}` : `${item.driver || "待分配"} · ${item.phone || "—"}`;
        const vehicle = staff ? "无需录入司机 / 车辆" : (item.vehicle || "待分配");
        const terminal=transportTerminal(a,type)||"行程场站待补全",rule=type==="dropoff"?dropoffStationRule(a):null;
        const operational=type==="pickup"?`<div><small>实际抵达场站</small><strong>${escapeHtml(terminal)}</strong></div><div><small>接机牌</small><strong>${escapeHtml(item.placard||"未设置")}</strong></div>`:`<div><small>送机时间</small><strong>${escapeHtml(item.time||recommendedDropoffTime(a)||"待人工填写")}</strong></div><div><small>送机地点 / 集合点</small><strong>${escapeHtml(item.point||"待设置")}</strong></div>`;
        cards.push(`<article class="transport-card"><div class="transport-head"><div><h3>${escapeHtml(a.name)} · ${type === "pickup" ? "接机 / 接站" : "送机 / 送站"}</h3><p>${escapeHtml(type === "pickup" ? `${a.outNo||"班次待补"} · ${a.outArrival||"--:--"} 到达` : `${a.returnNo||"班次待补"} · ${a.returnDeparture||"--:--"} 出发`)}</p>${item.batchName?`<span class="transport-batch-tag">⌘ ${escapeHtml(item.batchName)}</span>`:""}</div><span class="status ${assigned ? "status-normal" : "status-pending"}">${assigned ? (staff ? "工作人员安排" : "独立司机") : "待分配"}</span></div><div class="transport-details"><div><small>${staff?"工作人员":"司机"}</small><strong>${escapeHtml(contact)}</strong></div><div><small>${staff?"安排类型":"车辆 / 车牌"}</small><strong>${escapeHtml(vehicle)}</strong></div>${operational}</div><div class="transport-rule">${type==="pickup"?`接送点位直接取实际抵达场站，不设置时间或集合点。`:`返程出发场站：${escapeHtml(terminal)} · ${rule?`提前 ${Number(rule.minutes)||0} 分钟，参考 ${escapeHtml(recommendedDropoffTime(a)||"待补全班次时间")}`:"未匹配场站规则，请人工填写送机时间"}`}${item.placardFilePath?` · <button class="text-button" type="button" data-download-transport-placard="${escapeHtml(item.placardFilePath)}" data-placard-name="${escapeHtml(item.placardFileName||"接机牌样稿")}">查看接机牌附件</button>`:""}</div>${canManage() ? `<button class="transport-edit" data-edit-transport="${a.id}" data-type="${type}">编辑安排 →</button>` : ""}</article>`);
      });
    });
    $("#transportGrid").innerHTML = cards.join("") || `<div class="empty-state">暂无接送机记录</div>`; bindDynamicButtons();$$('[data-download-transport-placard]').forEach(button=>button.onclick=()=>downloadTransportPlacard(button.dataset.downloadTransportPlacard,button.dataset.placardName));
  }

  async function exportTransportPlan(){if(!window.XLSX)return toast("Excel 组件尚未加载，请刷新后重试","error");const headers=["方向","参会者","会场","航班/车次","实际场站","安排类型","工作人员/司机","联系电话","车辆/车牌","送机时间","送机地点/集合点","接机牌文字","接机牌附件","批次","备注"];const rows=activeVisibleAttendees().flatMap(a=>["pickup","dropoff"].map(direction=>{const t=a.transport?.[direction]||{},staff=isStaffTransport(t);return[direction==="pickup"?"接机/接站":"送机/送站",a.name,a.venue,direction==="pickup"?a.outNo:a.returnNo,transportTerminal(a,direction),staff?"工作人员":"独立司机",staff?(t.staffName||"会务工作人员"):(t.driver||""),t.phone||"",staff?"":(t.vehicle||""),direction==="pickup"?"":(t.time||""),direction==="pickup"?"":(t.point||""),direction==="pickup"?(t.placard||""):"",direction==="pickup"?(t.placardFileName||""):"",t.batchName||"",t.notes||""];}));const sheet=XLSX.utils.aoa_to_sheet([headers,...rows]);sheet["!cols"]=headers.map((_,index)=>({wch:[1,4,6,9,10,11,12,13,14].includes(index)?22:14}));const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,"接送执行安排");try{await writeStyledWorkbook(book,`${state.settings.slug||"会议"}-接送执行安排.xlsx`);toast("接送执行安排已按统一格式导出");}catch(error){toast(`导出失败：${error.message}`,"error");}}

  const comparableStation = value => String(value||"").replace(/(?:火车)?站$/u,"").replace(/\s+/g,"").trim();
  const verificationProviderLabel = check => check?.source?.label || ({variflight:"飞常准",rail_12306:"12306 公共查询",aerodatabox:"AeroDataBox（API.Market）",juhe_flight_dynamic:"聚合数据·全球航班动态",aliyun_train:"阿里云市场·聚合数据",train:"高铁计划接口",flight:"航班计划接口"}[check?.provider] || check?.provider || "计划时刻接口");
  const verifiedArrivalTime = match => match?.arrival ? `${match.arrival}${Number(match.arrivalDayOffset)>0?`+${match.arrivalDayOffset}`:""}` : "—";
  function verificationExport(check,attendee,segment) {
    if(check&&attendee&&check.fingerprint!==TravelVerification.fingerprint(attendee,segment))return "行程已变化或旧记录缺少快照，需重新核验";
    if(!check)return"未核验"; const match=check.match; const schedule=match?`${match.departure||"—"}-${verifiedArrivalTime(match)}`:"未查询到计划"; const warnings=check.warnings?.length?`；${check.warnings.join("；")}`:"";
    return `${schedule}｜${verificationProviderLabel(check)}｜${check.checkedAt?new Date(check.checkedAt).toLocaleString("zh-CN",{hour12:false}):"时间未知"}${warnings}`;
  }
  function verificationDetails(attendee) {
    const checks=attendee.customFields?._travelVerification||{}; if(!Object.keys(checks).length)return"";
    const card=(segment,label)=>{const check=checks[segment];if(!check)return`<div><small>${label}计划核验</small><strong>尚未核验</strong></div>`;const match=check.match;const source=(check.fingerprint!==TravelVerification.fingerprint(attendee,segment)?"旧核验记录（不适用于当前行程） · ":"")+verificationProviderLabel(check);const checked=check.checkedAt?new Date(check.checkedAt).toLocaleString("zh-CN",{hour12:false}):"时间未知";const reference=check.source?.referenceUrl?` · <a href="${escapeHtml(check.source.referenceUrl)}" target="_blank" rel="noopener">查看公开参考</a>`:"";return`<div><small>${label}计划核验</small><strong>${match?`${escapeHtml(match.departure||"—")} → ${escapeHtml(verifiedArrivalTime(match))}`:"未查询到计划时刻"}</strong><span>${escapeHtml(source)} · ${escapeHtml(checked)}${reference}</span></div>`;};
    const labels={outbound:0,return:0};return `<div class="detail-grid verification-grid">${verificationSegments(attendee).map(segment=>{const direction=TravelVerification.direction(segment),number=++labels[direction];return card(segment,`${direction==="return"?"返程":"去程"}第 ${number} 段`);}).join("")}</div>`;
  }
  const verificationSegments = attendee => TravelVerification.segments(attendee);
  function verificationState(attendee,segment) {
    const check=attendee.customFields?._travelVerification?.[segment];
    const issues=TravelVerification.currentIssues(attendee,segment);
    const current=check?.fingerprint===TravelVerification.fingerprint(attendee,segment);
    const verified=current&&check.status==="verified";
    const notices=current?(check.notices||[]):["尚未核验当前行程，请在行程核验板块查询"];
    return {segment,check,issues,verified,notices};
  }
  async function persistVerifiedAttendees(attendees,options={}) {
    if(backend){
      if(!backendMeetingId)throw new Error("当前会议未加载");
      const meetingId=backendMeetingId;
      for(const attendee of attendees){
        if(meetingId!==backendMeetingId)throw new Error("当前会议已切换");
        await TravelVerificationStorage.save(backend,meetingId,attendee,options);
        const current=state.attendees.find(item=>item.id===attendee.id);
        if(current&&!options.edit)current.customFields=attendee.customFields;
      }
    }
    persistStateLocally();
  }
  const verificationSelectionKey=(attendeeId,segment)=>`${attendeeId}:${segment}`;
  async function verifyTravelAttendees(attendees,{allowPaid=false,selection=null,disabledPaid=disabledVerificationFlightSegments}={}) {
    const meetingId=backendMeetingId;
    const isSelected=(attendee,segment)=>!selection||selection.has(verificationSelectionKey(attendee.id,segment));
    const journeys=attendees.flatMap(attendee=>verificationSegments(attendee).filter(segment=>isSelected(attendee,segment)&&TravelVerification.hasJourney(attendee,segment)).map(segment=>{
      const data=TravelVerification.snapshot(attendee,segment);
      const mode=TravelVerification.transportMode(data),selectionKey=verificationSelectionKey(attendee.id,segment);
      return {attendeeId:attendee.id,segment,...data,mode,allowPaid:mode==='flight'&&allowPaid&&!disabledPaid.has(selectionKey)};
    }));
    const results=[],groups=new Map();let failure="",cacheHits=0;
    for(const journey of journeys){
      const attendee=attendees.find(a=>a.id===journey.attendeeId),prior=attendee?.customFields?._travelVerification?.[journey.segment];
      const age=Date.now()-Date.parse(prior?.source?.checkedAt||prior?.checkedAt||'');
      if(prior?.match&&prior.fingerprint===TravelVerification.fingerprint(attendee,journey.segment)&&age>=0&&age<15*60000){results.push({...journey,found:true,match:prior.match,source:prior.source,provider:prior.provider,warnings:prior.notices||[]});continue;}
      let warning='';
      if(journey.mode==='local')continue;
      if(journey.mode==='flight'&&!journey.allowPaid){results.push({...journey,found:false,skippedNoAuthorization:true,warnings:[allowPaid?'本行已关闭飞常准查询；未取得有效计划数据，暂不能确认核验通过':'管理员尚未开启飞常准全局查询；未取得有效计划数据，暂不能确认核验通过']});continue;}
      if(!journey.number||!journey.date||!journey.from||!journey.to)warning='请补全日期、班次和具体场站';
      else if(journey.mode==='unknown')warning='航班或车次号有歧义，请人工确认交通类型和编号';
      if(warning){results.push({...journey,found:false,warnings:[warning]});continue;}
      const key=JSON.stringify([journey.mode,journey.date,journey.number.toUpperCase(),journey.from,journey.to]);
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(journey);
    }
    let ready=false;
    if(groups.size&&backend&&meetingId){
      try{
        const status=await documentApi(`/api/integrated/projects/${meetingId}/travel/status`,{signal:AbortSignal.timeout(15000)});
        if(status.version!==2)throw new Error('服务器尚未发布新版核验模块，已停止查询以避免调用旧收费接口');
        ready=true;
        const flightQuota=status.flight.unlimited?'不限每日次数':`每日 ${status.flight.dailyLimit} 次，今日已用 ${status.flight.usedToday||0} 次`;
        $("#verificationProviderStatus").textContent=`高铁：${status.train.configured?'已启用':'待配置'}；飞常准：${status.flight.configured?'已启用':'服务器待启用'}，全局查询${status.flight.globalEnabled?'已开启':'已关闭'}（${flightQuota}）。查询不代表已出票。`;
      }catch(error){failure=error.message||'无法确认服务器核验版本';}
    }
    let completed=0;
    const queuedGroups=[...groups.values()];
    if(queuedGroups.length)$("#verificationProgress").textContent=`已加入请求队列：0 / ${queuedGroups.length} 个不重复行程；系统将顺序核验，避免接口限流。`;
    for(const group of queuedGroups){
      if(meetingId!==backendMeetingId){failure='会议已切换，停止后续查询';break;}
      try{
        if(!backend||!meetingId)throw new Error('请正式登录后使用在线核验；演示页面不会调用数据源');
        if(!ready)throw new Error(failure||'核验服务尚未就绪');
        // One unique itinerary per request bounds latency; repeated attendees share the result.
        const batch=await documentApi(`/api/integrated/projects/${meetingId}/travel/verify`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),body:JSON.stringify({journeys:[group[0]],allowPaid:group[0].allowPaid===true})});
        const result=batch.results?.find(item=>item.attendeeId===group[0].attendeeId&&item.segment===group[0].segment);
        group.forEach(j=>results.push({...result,attendeeId:j.attendeeId,segment:j.segment,found:result?.found===true,warnings:result?.warnings||['接口未返回本段核验结果']}));
        cacheHits+=batch.usage?.cacheHits||0;
      }catch(error){failure=error.message||'接口暂时不可用';group.forEach(j=>results.push({...j,found:false,warnings:[failure]}));}
      $("#verificationProgress").textContent=`请求队列处理中：${++completed} / ${queuedGroups.length} 个不重复行程；不会自动覆盖名单。`;
      if(completed<queuedGroups.length)await new Promise(resolve=>setTimeout(resolve,250));
    }
    attendees.forEach(attendee=>{
      const checks={...(attendee.customFields?._travelVerification||{})};
      verificationSegments(attendee).filter(segment=>isSelected(attendee,segment)).forEach(segment=>{
        const result=results.find(item=>item.attendeeId===attendee.id&&item.segment===segment);
        if(result?.skippedNoAuthorization)delete checks[segment];else checks[segment]=TravelVerification.buildCheck(attendee,segment,{...(result||{found:false,warnings:[failure||'本段尚未查询']}),stationDictionary:stationDictionary()});
      });
      const highlights=new Set(attendee.customFields?._travelVerifiedHighlights||[]);
      for(const [segment,check] of Object.entries(checks))if(check.status==="verified")Object.values(TravelVerification.keys(segment)).filter(field=>/Station$/.test(field)).forEach(field=>highlights.add(field));
      attendee.customFields={...(attendee.customFields||{}),_travelVerification:checks,_travelVerifiedHighlights:[...highlights]};
    });
    return {failure,cacheHits};
  }
  function renderVerificationPage() {
    const preferences=loadSystemPreferences(),globalFlightEnabled=preferences.variflightGlobalEnabled===true;
    const result=TravelVerificationPanel.render(activeVisibleAttendees(),TravelVerification,{filter:$("#verificationFilter").value,query:$("#verificationSearch").value.trim(),canEdit:canManage()&&canEditAttendeeData(),isLocked,selected:selectedVerificationSegments,globalFlightEnabled,disabledPaid:disabledVerificationFlightSegments});
    const selectable=new Set(result.selectableKeys);for(const key of [...selectedVerificationSegments])if(!selectable.has(key))selectedVerificationSegments.delete(key);
    for(const key of [...disabledVerificationFlightSegments])if(!selectable.has(key))disabledVerificationFlightSegments.delete(key);
    $("#verificationPageSummary").innerHTML=result.summary;
    $("#verificationPageResults").innerHTML=result.html;
    $("#verificationNav").classList.toggle("is-hidden",!canManage());
    const globalSwitch=$("#verificationGlobalFlightEnabled");globalSwitch.checked=globalFlightEnabled;globalSwitch.disabled=verificationRunning||!isSystemAdmin();globalSwitch.onchange=()=>saveVerificationGlobalSetting(globalSwitch.checked);
    const visible=new Set(result.visibleSelectableKeys),selectVisible=$("#verificationSelectVisible");
    const syncVisibleSelection=()=>{const selectedVisible=[...visible].filter(key=>selectedVerificationSegments.has(key)).length;selectVisible.checked=visible.size>0&&selectedVisible===visible.size;selectVisible.indeterminate=selectedVisible>0&&selectedVisible<visible.size;};
    $$('[data-select-verification]',$('#verificationPageResults')).forEach(input=>input.onchange=()=>{const key=verificationSelectionKey(input.dataset.selectVerification,input.dataset.selectSegment);input.checked?selectedVerificationSegments.add(key):selectedVerificationSegments.delete(key);input.closest('.verify-card')?.classList.toggle('verify-card-selected',input.checked);syncVisibleSelection();updateVerificationSelectionControls();});
    $$('[data-disable-flight-query]',$('#verificationPageResults')).forEach(input=>input.onchange=()=>{const key=verificationSelectionKey(input.dataset.disableFlightQuery,input.dataset.disableSegment);input.checked?disabledVerificationFlightSegments.delete(key):disabledVerificationFlightSegments.add(key);input.closest('.verify-card')?.classList.toggle('verify-flight-disabled',!input.checked);});
    $$('[data-toggle-verification-detail]',$('#verificationPageResults')).forEach(button=>button.onclick=()=>{const key=button.dataset.toggleVerificationDetail,detail=$(`[data-verification-detail="${CSS.escape(key)}"]`,$('#verificationPageResults'));if(!detail)return;const expanded=detail.hidden;detail.hidden=!expanded;button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'收起详情':'展开详情';});
    syncVisibleSelection();selectVisible.disabled=verificationRunning||!canManage()||!visible.size;selectVisible.onchange=()=>{visible.forEach(key=>selectVisible.checked?selectedVerificationSegments.add(key):selectedVerificationSegments.delete(key));renderVerificationPage();};
    updateVerificationSelectionControls();
    $$('[data-review-travel]',$("#verificationPageResults")).forEach(button=>button.onclick=()=>{
      const attendee=activeVisibleAttendees().find(item=>item.id===button.dataset.reviewTravel);
      if(!attendee||!canManage()||!canEditAttendeeData()||isLocked(attendee))return deny();
      $("#attendeeDialog").showModal();showTripEditor(attendee,{verification:true,segments:[button.dataset.reviewSegment]});
    });
    $$('[data-reset-travel]',$("#verificationPageResults")).forEach(button=>button.onclick=()=>resetTravelVerification(button.dataset.resetTravel,button.dataset.resetSegment));
  }
  function updateVerificationSelectionControls(){const count=selectedVerificationSegments.size;$("#verificationSelectionCount").textContent=`已选 ${count} 段行程`;const button=$("#verifyRosterButton");button.textContent=verificationRunning?"⌛ 批量核验队列处理中":`批量核验已选行程 (${count})`;button.disabled=verificationRunning||!canManage()||!count;}
  async function resetTravelVerification(attendeeId,segment){
    const attendee=activeVisibleAttendees().find(item=>item.id===attendeeId);if(!attendee||!canManage()||isLocked(attendee))return deny();
    if(!confirm(`确认重置${segment==="return"?"返程":"去程"}核验状态及持久高亮？`))return;
    const draft={...attendee,customFields:{...(attendee.customFields||{}),_travelVerification:{...(attendee.customFields?._travelVerification||{})}}};
    delete draft.customFields._travelVerification[segment];
    const segmentFields=new Set(Object.values(TravelVerification.keys(segment)));draft.customFields._travelVerifiedHighlights=(draft.customFields._travelVerifiedHighlights||[]).filter(field=>!segmentFields.has(field));
    try{await persistVerifiedAttendees([draft]);Object.assign(attendee,draft);renderAll();renderVerificationPage();toast("核验状态及对应高亮已重置");}catch(error){toast(`重置失败：${error.message}`,"error");}
  }
  function renderTravelVerificationResults() {renderVerificationPage();location.hash="verification";}
  let verificationRunning=false;
  async function auditRosterTravel() {
    if(!canManage()||verificationRunning)return deny();
    const selection=new Set(selectedVerificationSegments);if(!selection.size)return toast("请先勾选需要核验的去程或返程","error");
    verificationRunning=true;
    const button=$("#verifyRosterButton");updateVerificationSelectionControls();
    try {
      const attendees=activeVisibleAttendees().filter(attendee=>[...selection].some(key=>key.startsWith(`${attendee.id}:`))).map(attendee=>({...attendee,customFields:{...(attendee.customFields||{}),_journeySegments:normalizedExtraJourneys(attendee.customFields?._journeySegments||[]),_travelVerification:{...(attendee.customFields?._travelVerification||{})}}}));
      const meetingId=backendMeetingId;
      const {failure}=await verifyTravelAttendees(attendees,{allowPaid:loadSystemPreferences().variflightGlobalEnabled===true,selection,disabledPaid:disabledVerificationFlightSegments});
      if(meetingId!==backendMeetingId||attendees.some(attendee=>{
        const current=state.attendees.find(item=>item.id===attendee.id);
        return !current||current.businessStatus==="cancelled"||verificationSegments(attendee).filter(segment=>selection.has(verificationSelectionKey(attendee.id,segment))).some(segment=>TravelVerification.fingerprint(current,segment)!==TravelVerification.fingerprint(attendee,segment));
      }))throw new Error("核验期间会议或行程已变化，请重新核验");
      attendees.forEach(attendee=>{const current=state.attendees.find(item=>item.id===attendee.id);Object.assign(attendee,{...current,customFields:{...(current.customFields||{}),_travelVerification:attendee.customFields._travelVerification,_travelVerifiedHighlights:attendee.customFields._travelVerifiedHighlights||current.customFields?._travelVerifiedHighlights||[]}});});
      await persistVerifiedAttendees(attendees);
      attendees.forEach(attendee=>{const current=state.attendees.find(item=>item.id===attendee.id);if(current)current.customFields=attendee.customFields;});
      addNotification("change",`${currentUser().name}完成${selection.size}段已选行程真实性核验；未触发审批`);
      persistStateLocally();
      selectedVerificationSegments.clear();renderAll();renderTravelVerificationResults();
      if(failure)toast(failure,"error");
    } catch(error) {toast(`核验结果尚未保存：${error.message}`,"error");}
    finally {verificationRunning=false;renderVerificationPage();updateVerificationSelectionControls();}
  }

  function timeBucket(value,minutes) {
    const match=String(value||"").match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/); if(!match)return"";
    const total=Number(match[2])*60+Number(match[3]); const rounded=Math.floor(total/minutes)*minutes;
    return `${match[1]} ${String(Math.floor(rounded/60)).padStart(2,"0")}:${String(rounded%60).padStart(2,"0")}`;
  }

  function autoArrangeTransport() {
    if(!canManage()||state.locks.master||state.locks.columns.includes("transport"))return toast("接送机名单或整列已锁定，不能自动排列","error");
    const minutes=Math.min(180,Math.max(10,Number(state.settings.transportGroupMinutes)||30)); const groups=new Map(); let skipped=0;
    const add=(attendee,direction,terminal,serviceTime,number)=>{
      if(!terminal||!serviceTime||!isPreciseTerminal(terminal,number)){skipped++;return;}
      const existing=attendee.transport?.[direction]||{}; if(transportIsAssigned(existing)){return;}
      const bucket=timeBucket(serviceTime,minutes); if(!bucket){skipped++;return;} const key=`${direction}|${terminal}|${bucket}`;
      if(!groups.has(key))groups.set(key,{direction,terminal,bucket,members:[]}); groups.get(key).members.push(attendee);
    };
    activeVisibleAttendees().filter(attendee=>!isFieldLocked(attendee,"transport")).forEach(attendee=>{
      add(attendee,"pickup",transportTerminal(attendee,"pickup"),transportDate(attendee,"pickup")&&transportClock(attendee,"pickup")?`${transportDate(attendee,"pickup")} ${transportClock(attendee,"pickup")}`:"",attendee.outNo);
      add(attendee,"dropoff",transportTerminal(attendee,"dropoff"),recommendedDropoffTime(attendee),attendee.returnNo);
    });
    groups.forEach(group=>{const batchId=crypto.randomUUID();const label=group.direction==="pickup"?"接机/接站":"送机/送站";const batchName=`${group.bucket.slice(5)} ${group.terminal} ${label}`;group.members.forEach(attendee=>{const serviceTime=group.direction==="pickup"?"":recommendedDropoffTime(attendee);attendee.transport[group.direction]={batchId,batchName,mode:"suggested",staffName:"",driver:"待分配",phone:"—",vehicle:"待分配",time:serviceTime,point:"",terminal:transportTerminal(attendee,group.direction),capacity:group.members.length,notes:"系统按场站与班次生成参考批次，待会务负责人确认",timeStrategy:group.direction==="pickup"?"none":"rule",timeSource:group.direction==="pickup"?"none":"rule"};});});
    const arranged=[...groups.values()].reduce((sum,group)=>sum+group.members.length,0); addNotification("change",`${currentUser().name}自动排列接送表：生成${groups.size}个建议批次、${arranged}人次`); saveState(); renderAll(); toast(`已生成 ${groups.size} 个建议批次、安排 ${arranged} 人次${skipped?`；${skipped}人次因站点或时间不明确未排列`:""}`);
  }

  function transportBatchGroups(list=visibleAttendees()) {
    const groups=new Map();
    list.forEach(attendee=>["pickup","dropoff"].forEach(direction=>{ const item=attendee.transport?.[direction]; if(!item?.batchId)return; if(!groups.has(item.batchId))groups.set(item.batchId,{id:item.batchId,direction,item,members:[]}); groups.get(item.batchId).members.push(attendee); }));
    return [...groups.values()];
  }

  function renderTransportBatches(list) {
    const groups=transportBatchGroups(list).filter(group=>activeTransportFilter==="all"||group.direction===activeTransportFilter);
    $("#transportBatchList").innerHTML=groups.map(group=>{ const {item,members,direction}=group; const staff=isStaffTransport(item); const capacity=Number(item.capacity)||members.length; return `<article class="batch-summary-card" style="--batch-color:${direction==="pickup"?"#9b62b4":"#5267d9"}"><div class="batch-summary-head"><span class="batch-summary-icon">${direction==="pickup"?"⌁":"↗"}</span><span class="status status-normal">${direction==="pickup"?"接机批次":"送机批次"}</span></div><h3>${escapeHtml(item.batchName||"未命名批次")}</h3><p>${escapeHtml(item.terminal||"地点取自参会人实际场站")} · ${staff?escapeHtml(item.staffName||"工作人员"):escapeHtml(item.vehicle||"车辆待定")}</p><div class="batch-summary-meta"><div><small>${direction==="pickup"?"执行方式":"送机时间"}</small><strong>${direction==="pickup"?"抵达场站直接接待":escapeHtml(item.time||"按每人场站规则")}</strong></div><div><small>已安排人数</small><strong>${members.length} / ${capacity}</strong></div></div><div class="batch-summary-actions"><button class="button button-secondary" data-edit-batch="${group.id}" ${canManage()?"":"disabled"}>编辑批次</button></div></article>`; }).join("");
    $$('[data-edit-batch]').forEach(button=>button.onclick=()=>openTransportBatch(null,button.dataset.editBatch));
  }

  function transportIsAssigned(item={}) { return isStaffTransport(item)||(item.driver&&item.driver!=="待分配"); }
  function batchRouteValue(attendee,direction,key) { if(key==="date")return transportDate(attendee,direction); if(key==="city")return transportTerminal(attendee,direction); return ""; }

  function openTransportBatch(direction,batchId="") {
    if(!canManage())return deny(); if(state.locks.master||state.locks.columns.includes("transport"))return toast("接送机名单或整列已锁定，不能调整批次","error");
    const form=$("#transportBatchForm"); form.reset(); form.elements.batchId.value=batchId;
    const group=batchId?transportBatchGroups(state.attendees).find(item=>item.id===batchId):null; direction=direction||group?.direction||"pickup"; form.elements.direction.value=direction;
    $("#batchDialogTitle").textContent=direction==="pickup"?"批量接机 / 接站":"批量送机 / 送站";
    const strategy=form.elements.timeStrategy; strategy.value=direction==="pickup"?"rule":"rule";
    const cities=[...new Set(state.attendees.map(a=>batchRouteValue(a,direction,"city")).filter(Boolean))]; $("#transportTerminals").innerHTML=cities.map(city=>`<option value="${escapeHtml(city)}"></option>`).join("");
    if(group){ const item=group.item; const first=group.members[0]; Object.entries({batchName:item.batchName,serviceDate:batchRouteValue(first,direction,"date"),terminal:item.terminal,timeStrategy:item.timeStrategy||"rule",serviceClock:String(item.time||"").match(/(\d{2}:\d{2})/)?.[1]||"",staffName:item.staffName,staffPhone:item.phone,placard:item.placard,point:item.point,capacity:item.capacity||group.members.length,notes:item.notes}).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=value??"";}); }
    else { const first=state.attendees[0]; form.elements.serviceDate.value=batchRouteValue(first||{},direction,"date")||""; form.elements.capacity.value=direction==="pickup"?50:7; form.elements.mode.value="staff"; }
    toggleBatchModeFields(); renderBatchCandidates(); $("#transportBatchDialog").showModal();
  }

  function toggleBatchModeFields() {
    const form=$("#transportBatchForm"),pickup=form.elements.direction.value==="pickup",fixed=!pickup&&form.elements.timeStrategy.value==="fixed";
    [form.elements.staffName,form.elements.staffPhone].forEach(input=>input.required=true);
    $("#batchTimeStrategyField").classList.toggle("is-hidden",pickup);$("#batchClockField").classList.toggle("is-hidden",!fixed);form.elements.serviceClock.required=fixed;
    $("#batchPointField").classList.toggle("is-hidden",pickup);form.elements.point.required=!pickup;
    $("#batchPlacardTextField").classList.toggle("is-hidden",!pickup);$("#batchPlacardFileField").classList.toggle("is-hidden",!pickup);
  }

  function renderBatchCandidates() {
    const form=$("#transportBatchForm"); const direction=form.elements.direction.value||"pickup"; const date=form.elements.serviceDate.value; const terminal=form.elements.terminal.value.trim(); const editingId=form.elements.batchId.value;
    toggleBatchModeFields();
    if(!date){ $("#batchAttendeeList").innerHTML=`<div class="batch-empty">请先选择日期</div>`; return updateBatchCapacityNotice(); }
    const matches=activeVisibleAttendees().filter(attendee=>{ const station=batchRouteValue(attendee,direction,"city"); const terminalMatch=!terminal||comparableStation(terminal)===comparableStation(station); return batchRouteValue(attendee,direction,"date")===date&&terminalMatch; });
    $("#batchAttendeeList").innerHTML=matches.length?matches.map(attendee=>{ const item=attendee.transport?.[direction]||{}; const conflict=transportIsAssigned(item)&&item.batchId!==editingId; const checked=item.batchId===editingId; const locked=isFieldLocked(attendee,"transport"); const trip=direction==="pickup"?`${attendee.outNo} · ${attendee.outArrival}抵达`:`${attendee.returnNo} · ${attendee.returnDeparture}出发`; return `<label class="batch-attendee-option"><input type="checkbox" name="batchAttendee" value="${attendee.id}" ${checked?"checked":""} ${locked?"disabled":""}/><p><strong>${escapeHtml(attendee.name)}</strong><small>${escapeHtml(trip)} · ${escapeHtml(batchRouteValue(attendee,direction,"city"))}</small></p><span class="${conflict?"assigned-warning":""}">${locked?"已锁定":conflict?`已有${direction==="pickup"?"接机":"送机"}安排`:checked?"本批次":"可加入"}</span></label>`; }).join(""):`<div class="batch-empty">没有符合该日期和地点的参会者</div>`;
    $$('[name="batchAttendee"]',$("#batchAttendeeList")).forEach(input=>input.addEventListener("change",updateBatchCapacityNotice)); $("#selectAllBatchAttendees").checked=false; updateBatchCapacityNotice();
  }

  function updateBatchCapacityNotice() {
    const selected=$$('[name="batchAttendee"]:checked',$("#batchAttendeeList")).length; const capacity=Number($("#transportBatchForm").elements.capacity.value)||0; const notice=$("#batchCapacityNotice"); notice.classList.toggle("warning",selected>capacity); notice.textContent=selected>capacity?`已选择 ${selected} 人，超过人数上限 ${capacity} 人，请减少人员或调整车辆容量。`:`已选择 ${selected} 人 · 剩余容量 ${Math.max(0,capacity-selected)} 人`;
  }

  function resetTransportAssignment(attendee,direction) {
    attendee.transport[direction]={driver:"待分配",phone:"—",vehicle:"待分配",time:"",point:"",terminal:transportTerminal(attendee,direction)};
  }

  async function uploadTransportPlacard(file,scopeId){if(!file)return null;if(file.size>15*1024*1024)throw new Error("接机牌附件不能超过 15MB");if(!backend)return{path:"",name:file.name,size:file.size};const safe=file.name.replace(/[^\w.\-\u4e00-\u9fff]+/g,"-");const path=`${backendMeetingId}/${scopeId}/${crypto.randomUUID()}-${safe}`;const result=await backend.storage.from("transport-placards").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});if(result.error)throw result.error;return{path,name:file.name,size:file.size};}
  async function downloadTransportPlacard(path,name){if(!path||!backend)return;try{const{data,error}=await backend.storage.from("transport-placards").createSignedUrl(path,60,{download:name||"接机牌样稿"});if(error)throw error;window.open(data.signedUrl,"_blank","noopener");}catch(error){toast(error.message||"接机牌附件下载失败","error");}}

  async function saveTransportBatch(event) {
    event.preventDefault(); if(!canManage()||state.locks.master||state.locks.columns.includes("transport"))return toast("接送机名单或整列已锁定，不能调整批次","error");
    const form=event.currentTarget; const data=Object.fromEntries(new FormData(form)); const selectedIds=$$('[name="batchAttendee"]:checked',$("#batchAttendeeList")).map(input=>input.value); const capacity=Number(data.capacity)||0;
    if(!selectedIds.length)return toast("请至少选择一位参会者","error"); if(selectedIds.length>capacity)return toast("选择人数超过批次人数上限","error");
    const direction=data.direction; const conflicts=selectedIds.map(id=>state.attendees.find(a=>a.id===id)).filter(a=>{const item=a?.transport?.[direction]||{};return transportIsAssigned(item)&&item.batchId!==data.batchId;});
    if(conflicts.length&&!confirm(`${conflicts.length} 位参会者已有安排，确认覆盖并加入新批次吗？`))return;
    const batchId=data.batchId||crypto.randomUUID();
    if(data.batchId) transportBatchGroups(state.attendees).find(group=>group.id===data.batchId)?.members.filter(member=>!selectedIds.includes(member.id)).forEach(member=>resetTransportAssignment(member,direction));
    let fileMeta=null;try{fileMeta=await uploadTransportPlacard(form.elements.placardFile?.files?.[0],batchId);}catch(error){return toast(error.message,"error");}
    selectedIds.forEach(id=>{ const attendee=state.attendees.find(item=>item.id===id),previous=attendee.transport?.[direction]||{}; const time=direction==="pickup"?"":data.timeStrategy==="fixed"?`${data.serviceDate} ${data.serviceClock}`:recommendedDropoffTime(attendee); attendee.transport[direction]={batchId,batchName:data.batchName,mode:"staff",staffName:data.staffName,driver:"会务工作人员",phone:data.staffPhone,vehicle:"",time:time||"",point:direction==="pickup"?"":data.point,terminal:transportTerminal(attendee,direction),placard:direction==="pickup"?data.placard:"",placardFilePath:fileMeta?.path||previous.placardFilePath||"",placardFileName:fileMeta?.name||previous.placardFileName||"",placardFileSize:fileMeta?.size||previous.placardFileSize||0,capacity,notes:data.notes,timeStrategy:direction==="pickup"?"none":data.timeStrategy,timeSource:direction==="pickup"?"none":data.timeStrategy==="fixed"?"manual":"rule"}; });
    addNotification("change",`${currentUser().name}${data.batchId?"更新":"创建"}了${data.batchName}，共安排${selectedIds.length}人`); saveState(); $("#transportBatchDialog").close(); renderAll(); toast(`接送批次已保存，共 ${selectedIds.length} 人`);
  }

  function renderLocks() {
    const activeIds=new Set(activeVisibleAttendees().map(a=>a.id));state.locks.rows=state.locks.rows.filter(id=>activeIds.has(id));
    $("#masterLock").checked = state.locks.master; $("#masterLock").disabled = !canManage();
    $("#columnLocks").innerHTML = COLUMN_LOCKS.map(([key,label]) => {const locked=state.locks.columns.includes(key);return`<label class="lock-chip ${locked?"locked":""}"><input type="checkbox" data-column-lock="${key}" ${locked?"checked":""} ${canManage()?"":"disabled"}/><span><strong>${label}</strong><small>${locked?"整列已锁定 · 点击解锁":"整列可编辑 · 点击锁定"}</small></span></label>`;}).join("");
    $("#rowLocks").innerHTML = activeVisibleAttendees().map(a => {const locked=state.locks.rows.includes(a.id);return`<div class="row-lock-item ${locked?"locked":""}"><span class="person-avatar">${escapeHtml(a.name[0])}</span><p><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.hospital)} · ${locked?"整行已锁定":"整行可编辑"}</small></p><label class="switch"><input type="checkbox" data-row-lock="${a.id}" ${locked?"checked":""} ${canEditAttendeeData()?"":"disabled"}/><span></span></label></div>`;}).join("")||`<div class="empty-state">暂无有效参会人员</div>`;
    $$('[data-column-lock]').forEach(input => input.addEventListener("change", () => toggleArrayValue(state.locks.columns, input.dataset.columnLock, input.checked, "列锁定规则")));
    $$('[data-row-lock]').forEach(input => input.addEventListener("change", () => toggleArrayValue(state.locks.rows, input.dataset.rowLock, input.checked, `${state.attendees.find(a => a.id === input.dataset.rowLock)?.name}的报名信息`)));
  }
  async function toggleArrayValue(array, value, checked, label) {
    const previous=[...array];
    if (checked && !array.includes(value)) array.push(value); if (!checked) array.splice(array.indexOf(value), 1);
    try{
      if(backend&&array===state.locks.columns){const{error}=await backend.from("column_locks").upsert({meeting_id:backendMeetingId,field_group:value,locked:checked,updated_by:state.currentUserId},{onConflict:"meeting_id,field_group"});if(error)throw error;}
      addNotification("lock", `${currentUser().name}${checked ? "锁定" : "解锁"}了${label}`);saveState();renderAll();
    }catch(error){array.splice(0,array.length,...previous);renderAll();toast(`锁定状态保存失败：${error.message}`,"error");}
  }

  function renderNotifications() {
    const icons = { change: "↻", approval: "✓", lock: "▣", create: "+" };
    const reminders=state.notifications.filter(n=>n.publicSource||(!backend&&n.auditOnly!==true));
    $("#notificationList").innerHTML = reminders.length ? reminders.map(n => `<button type="button" class="notification-item ${n.read?"":"unread"}" data-notification-detail="${escapeHtml(String(n.id))}"><span class="notice-icon">${icons[n.type]||"◌"}</span><p><strong>${escapeHtml(n.attendeeName||"报名端变更")}</strong>${escapeHtml(n.text)}</p><small>${new Date(n.time).toLocaleString("zh-CN",{hour12:false})}${n.changes?.length?` · ${n.changes.length}项变更`:""}</small></button>`).join("") : `<div class="empty-state">暂无报名端新增或自行修改提醒；管理员操作请在系统设置的全局操作日志中查询。</div>`;
    $$('[data-notification-detail]').forEach(button=>button.onclick=()=>openNotificationDetail(button.dataset.notificationDetail));
  }
  function openNotificationDetail(id){const item=state.notifications.find(n=>String(n.id)===String(id));if(!item)return;item.read=true;const changes=item.changes||[];$("#notificationDetailContent").innerHTML=`<div class="detail-head"><span class="kicker">CHANGE LOG</span><h2>${escapeHtml(item.attendeeName||"变更详情")}</h2><p>${escapeHtml(item.actorName||"系统")} · ${new Date(item.time).toLocaleString("zh-CN",{hour12:false})}</p></div><div class="detail-body"><div class="change-detail-list">${changes.length?changes.map(change=>`<div class="change-detail-row"><strong>${escapeHtml(change.label||change.field||"字段")}</strong><span class="change-before"><small>修改前</small>${escapeHtml(String(change.before??"未填写"))}</span><b>→</b><span class="change-after"><small>修改后</small>${escapeHtml(String(change.after??"未填写"))}</span></div>`).join(""):`<div class="empty-state">该历史提醒仅保存了操作摘要：${escapeHtml(item.text)}</div>`}</div></div>`;persistStateLocally();renderNotifications();renderCounts();$("#notificationDetailDialog").showModal();}
  function renderSettings() {
    const form = $("#settingsForm");
    if(!form.elements.fieldClothingSize){const grid=form.querySelector(".field-toggle-grid");const label=document.createElement("label");label.className="check-row";label.innerHTML='<input name="fieldClothingSize" type="checkbox" /> 收集衣服尺寸';grid?.append(label);}
    const travelRules=state.settings.travelApprovalRules||{};const roomRules=configuredRoomingRules();
    const values = { eventName:state.settings.eventName, clientName:state.settings.clientName, startDate:state.settings.startDate, endDate:state.settings.endDate, venues:state.settings.venues.map(normalizeVenueLabel).filter(Boolean).join("、"), registrationRegions:(state.settings.quotaRegions||[]).join("、"), deadline:state.settings.deadline, capacity:state.settings.capacity, servicePhone:state.settings.servicePhone, flightLeadMinutes:state.settings.flightLeadMinutes, trainLeadMinutes:state.settings.trainLeadMinutes, transportGroupMinutes:state.settings.transportGroupMinutes||30, earliestArrival:travelRules.earliestArrival||travelRules.arrivalStart||"", latestDeparture:travelRules.latestDeparture||travelRules.returnEnd||"", tourismCities:(travelRules.tourismCities||DEFAULT_TOURISM_CITIES).join("、"), singleRoomTitles:(roomRules.singleTitles||[]).join("、"), twinSingleKeywords:(roomRules.twinSingleKeywords||[]).join("、"), defaultRoomType:roomRules.defaultType||"shared", pairingPriority1:roomRules.pairingPriorities[0], pairingPriority2:roomRules.pairingPriorities[1], pairingPriority3:roomRules.pairingPriorities[2], pairingPriority4:roomRules.pairingPriorities[3] };
    Object.entries(values).forEach(([name,value]) => { if (form.elements[name]) form.elements[name].value=value??""; });
    form.elements.mismatchRule.checked = travelRules.mismatchEnabled??state.settings.mismatchRule; form.elements.approvalTimeRule.checked=!!travelRules.timeEnabled;form.elements.tourismCityRule.checked=!!travelRules.tourismEnabled;form.elements.roomConflictApproval.checked=roomRules.conflictApproval!==false;
    const fieldNames = {fieldTitle:"title",fieldHcpId:"hcpId",fieldAccommodation:"accommodation",fieldFlight:"flight",fieldMslContact:"mslContact",fieldRemarks:"remarks",fieldClothingSize:"clothingSize"};
    Object.entries(fieldNames).forEach(([name,key]) => form.elements[name].checked = state.settings.fieldConfig[key] !== false);
    $("#transferCollectionSwitch").checked=!!state.settings.transferCollectionEnabled;const allowedTransferRoles=new Set(state.settings.transferCollectionRoles||[]);$$('[name="transferCollectionRole"]',form).forEach(input=>input.checked=allowedTransferRoles.has(input.value));$("#transferCollectionStatus").textContent=state.settings.transferCollectionEnabled?"已启用":"未启用";$("#transferCollectionStatus").className=`status ${state.settings.transferCollectionEnabled?"status-ok":"status-locked"}`;
    const template=state.settings.registrationTemplate?.columns?.length ? state.settings.registrationTemplate : {columns:[]};
    const customCount=template.columns.filter(column=>column.custom).length;
    $("#templateStatus").innerHTML=state.settings.templateImported?`<span class="template-type-badge ${state.settings.templateIsSystemDefault?"default":"custom"}">${state.settings.templateIsSystemDefault?"系统内置默认模板":"自定义模板"}</span><strong>${escapeHtml(state.settings.templateName||"报名字段配置已保留")}</strong><small>${template.columns.filter(column=>column.key!=="sequence").length} 个报名字段${customCount?` · ${customCount} 个自定义字段`:""}${!state.settings.templateName&&!state.settings.templateIsSystemDefault?" · 原始附件已删除":""}</small>`:`<strong>报名模板未配置（可选）</strong><small>项目仍可直接开放报名，报名端自动使用系统默认基础字段</small>`;
    $("#templateColumns").innerHTML=template.columns.length?template.columns.filter(column=>column.key!=="sequence").map(column=>`<span class="${column.custom?"custom":""}">${escapeHtml(column.header.replace(/\s+/g," "))}${column.required?" *":""}</span>`).join(""):`<span>等待导入 Excel / CSV 模板</span>`;
    $$('input,textarea,select,button[type="submit"]', form).forEach(input => input.disabled = !canManage() && input.id !== "resetDemo");
    const roomPanel=form.querySelector(".rooming-rules-panel"), internal=isInternalMeeting();
    const approvalPanel=form.querySelector(".approval-rules-panel");if(approvalPanel){approvalPanel.classList.toggle("internal-disabled-approval",internal);$("#approvalRuleScope").textContent=internal?"内部会议不启用":"外部会议生效";$("#approvalRuleScope").className=`status ${internal?"status-locked":"status-normal"}`;$$('input,textarea,select',approvalPanel).forEach(input=>input.disabled=internal||!canManage());}
    if(roomPanel){roomPanel.classList.toggle("internal-manual-rooming",internal);const heading=roomPanel.querySelector("h2"),copy=roomPanel.querySelector(".panel-heading p");heading.textContent=internal?"内部会议分房方式":"外部会议分房规则";copy.textContent=internal?"内部会议采用人工分房，不执行职称、医院、城市、省份或大区自动匹配规则。":"按职称建议房型，并按医院、城市、省份和大区匹配同性拼住。";$$('input,textarea,select',roomPanel).forEach(input=>input.disabled=internal||!canManage());}
    $("#projectTemplateFile").disabled=!canManage();
    const attachmentDelete=$("#removeProjectTemplateAttachment");attachmentDelete.classList.toggle("is-hidden",!canManage());attachmentDelete.disabled=!state.settings.templateImported||state.settings.templateIsSystemDefault||(!state.settings.templateName&&!state.settings.templateStoragePath);attachmentDelete.title=state.settings.templateIsSystemDefault?"系统内置默认模板没有可删除附件":(!state.settings.templateName&&!state.settings.templateStoragePath)?"原始模板附件已删除":"仅删除原始附件，报名字段和历史数据保留";
    const templateDelete=$("#resetProjectTemplate");templateDelete.classList.toggle("is-hidden",!canManage());templateDelete.disabled=!state.settings.templateImported||state.settings.templateIsSystemDefault||state.settings.registrationOpen;templateDelete.title=state.settings.templateIsSystemDefault?"系统内置默认模板不允许删除":state.settings.registrationOpen?"请先关闭报名开关":"删除当前自定义模板及字段配置";
    $("#registrationOpenSwitch").checked=!!state.settings.registrationOpen;$("#registrationOpenSwitch").disabled=!canManage();
    $("#registrationOpenStatus").textContent=state.settings.registrationOpen?"报名开放":"报名关闭";$("#registrationOpenStatus").className=`status ${state.settings.registrationOpen?"status-ok":"status-locked"}`;
    $("#registrationOpenHint").textContent=state.settings.registrationOpen?(state.settings.templateImported?"当前允许新增报名，使用已配置模板":"当前允许新增报名，使用系统默认基础字段"):(state.settings.templateImported?"关闭后仍可更改已报名和查询参会信息":"无需报名模板也可直接开启");
    $("#managerEditSwitch").checked=!!state.settings.managerEditEnabled;$("#managerEditSwitch").disabled=!(isSystemAdmin()||currentProject()?.ownerUserId===state.currentUserId);
    $$(".quota-settings-panel").forEach(panel=>panel.classList.toggle("is-hidden",state.settings.activityType==="internal"));
    renderTransportStationRules();
    renderSettingsQuotaSummary();
    renderSystemStaffDirectory();
    renderProjectClientAccounts();
    $("#resetDemo").classList.toggle("is-hidden", !!backend);
  }

  function renderTransportStationRules(){
    const box=$("#transportStationRules");if(!box)return;
    const rules=state.settings.transportStationRules||[];
    box.innerHTML=rules.length?rules.map((rule,index)=>`<div class="transport-station-rule-row"><input name="transportRuleStation" value="${escapeHtml(rule.station||"")}" placeholder="例如：大连周水子机场 / 大连北站" ${canManage()?"":"disabled"}/><input name="transportRuleMinutes" type="number" min="0" step="5" value="${Number(rule.minutes)||0}" ${canManage()?"":"disabled"}/><button class="button button-secondary" type="button" data-delete-transport-rule="${index}" ${canManage()?"":"disabled"}>删除</button></div>`).join(""):`<div class="empty-state">尚未配置场站规则；未匹配场站的送机时间由会务人员手动填写。</div>`;
    $$('[data-delete-transport-rule]',box).forEach(button=>button.onclick=()=>{state.settings.transportStationRules.splice(Number(button.dataset.deleteTransportRule),1);renderTransportStationRules();});
  }

  function renderSettingsQuotaSummary() {
    if(state.settings.activityType==="internal"){$("#quotaSettingsStatus").textContent="内部会议不启用";$("#quotaSettingsSummary").innerHTML=`<div class="quota-settings-empty">内部会议不设置会场、大区听众名额；报名提交不做名额占用和超限校验。</div>`;return;}
    const rows=normalizedQuotaConfiguration();
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
    $$('[data-travel-decision]').forEach(button=>button.onclick=()=>decideTravelApproval(button.dataset.attendee,button.dataset.segment,button.dataset.travelDecision));
    $$('[data-room-decision]').forEach(button=>button.onclick=()=>decideRoomingApproval(button.dataset.attendee,button.dataset.roomDecision));
    $$('[data-edit-transport]').forEach(button => button.onclick = () => editTransport(button.dataset.editTransport, button.dataset.type));
  }

  function openAttendee(id) {
    const a = state.attendees.find(item => item.id === id); if (!a) return;
    const locked = isLocked(a); const canEdit = !locked && canEditAttendeeData() && (canManage() || isSystemAdmin() || a.ownerId === currentUser().id);
    $("#attendeeDetail").innerHTML = `<div class="detail-head"><span class="kicker" style="color:#b9ddc5">ATTENDEE DETAIL</span><h2>${escapeHtml(a.name)}</h2><p>${escapeHtml(a.hospital)} · ${escapeHtml(a.department)} · ${escapeHtml(userName(a.ownerId))}负责</p></div><div class="detail-body"><div class="detail-grid"><div class="detail-block"><small>手机号</small><strong>${escapeHtml(a.phone)}</strong></div><div class="detail-block"><small>客户编号</small><strong>${escapeHtml(a.hcpId)}</strong></div><div class="detail-block"><small>去程</small><strong>${escapeHtml(a.outNo)} · ${fmtDate(a.outDate)} ${escapeHtml(a.outDeparture)}</strong></div><div class="detail-block"><small>返程</small><strong>${escapeHtml(a.returnNo)} · ${fmtDate(a.returnDate)} ${escapeHtml(a.returnDeparture)}</strong></div><div class="detail-block"><small>去程路线</small><strong>${escapeHtml(a.outFrom)} → ${escapeHtml(a.outTo)}</strong></div><div class="detail-block"><small>返程路线</small><strong>${escapeHtml(a.returnFrom)} → ${escapeHtml(a.returnTo)}</strong></div></div>${verificationDetails(a)}${a.risks.length ? `<div class="risk-preview warning">${a.risks.map(r => `△ ${escapeHtml(r)}`).join("<br>")}</div>` : `<div class="risk-preview ok">✓ 当前行程符合预设规则</div>`}<div class="detail-actions">${canEdit ? `<button class="button button-primary" id="editTripButton">修改行程</button>` : `<span class="status status-locked">${locked ? "名单已锁定" : "无修改权限"}</span>`}<button class="button button-secondary" id="closeDetailButton">关闭</button></div></div>`;
    const extras=a.customFields?._journeySegments||[];if(extras.length){const counts={outbound:1,return:1},html=extras.map(item=>{const direction=item.direction==="return"?"return":"outbound",label=`${direction==="return"?"返程":"去程"}第 ${++counts[direction]} 段`;return `<div class="detail-block"><small>${escapeHtml(label)} · ${escapeHtml(TravelFields.TYPES[item.transportType]||item.transportType||"未选择")}</small><strong>${escapeHtml(item.number||"未填写")} · ${escapeHtml(item.departDate||"—")} ${escapeHtml(item.departure||"—")}</strong><span>${escapeHtml(item.departCity||"—")} / ${escapeHtml(TravelFields.displayStation(item.departStation,item.transportType,stationDictionary())||"—")} → ${escapeHtml(item.arriveCity||"—")} / ${escapeHtml(TravelFields.displayStation(item.arriveStation,item.transportType,stationDictionary())||"—")}</span></div>`;}).join("");$("#attendeeDetail .detail-grid").insertAdjacentHTML("afterend",`<div class="detail-grid extra-trip-detail-grid">${html}</div>`);}
    if(state.settings.transferCollectionEnabled){const block=`<h3>去程出发地（属地）送站信息</h3><div class="detail-grid transfer-detail-grid"><div class="detail-block"><small>属地送站出发地点</small><strong>${escapeHtml(a.outboundTransferOrigin||"未填写")}</strong></div><div class="detail-block"><small>属地预约送站时间</small><strong>${escapeHtml(a.outboundTransferTime||"未填写")}</strong></div><div class="detail-block"><small>属地送站备注</small><strong>${escapeHtml(a.outboundTransferNotes||"未填写")}</strong></div></div><h3>返程出发地（属地）接站信息</h3><div class="detail-grid transfer-detail-grid"><div class="detail-block"><small>属地接站送达目的地</small><strong>${escapeHtml(a.returnTransferDestination||"未填写")}</strong></div><div class="detail-block"><small>属地预估接站时间</small><strong>${escapeHtml(a.returnTransferTime||"未填写")}</strong></div><div class="detail-block"><small>属地接站备注</small><strong>${escapeHtml(a.returnTransferNotes||"未填写")}</strong></div></div>`;$("#attendeeDetail .detail-body").insertAdjacentHTML("afterbegin",block);if(canEdit)$("#attendeeDetail .detail-actions").insertAdjacentHTML("afterbegin",'<button class="button button-secondary" id="editTransferCollectionButton">编辑属地接送信息</button>');}
    const dialog = $("#attendeeDialog"); dialog.showModal(); $("#closeDetailButton").onclick = () => dialog.close(); if (canEdit) $("#editTripButton").onclick = () => showTripEditor(a);if($("#editTransferCollectionButton"))$("#editTransferCollectionButton").onclick=()=>showTransferCollectionEditor(a);
  }

  function showTransferCollectionEditor(a){if(!canEditAttendeeData())return deny();const renderFields=fields=>fields.map(([key,label,type])=>`<label class="${type==="textarea"?"span-2":""}">${label}${type==="textarea"?`<textarea name="${key}" rows="2">${escapeHtml(a[key]||"")}</textarea>`:`<input name="${key}" type="${type}" value="${escapeHtml(a[key]||"")}" />`}</label>`).join("");const outboundFields=[["outboundTransferOrigin","属地送站出发地点","text"],["outboundTransferTime","属地预约送站时间","datetime-local"],["outboundTransferNotes","属地送站备注","textarea"]],returnFields=[["returnTransferDestination","属地接站送达目的地","text"],["returnTransferTime","属地预估接站时间","datetime-local"],["returnTransferNotes","属地接站备注","textarea"]];$("#attendeeDetail").innerHTML=`<div class="detail-head"><span class="kicker">LOCAL TRANSFER</span><h2>编辑 ${escapeHtml(a.name)} 的出发地（属地）接送信息</h2><p>去程与返程分别维护；全部选填，不参与行程真实性核验或审批。</p></div><form class="detail-body" id="transferCollectionEditForm"><h3>去程出发地（属地）送站信息</h3><div class="field-grid">${renderFields(outboundFields)}</div><h3>返程出发地（属地）接站信息</h3><div class="field-grid">${renderFields(returnFields)}</div><div class="detail-actions"><button class="button button-primary" type="submit">保存属地接送信息</button><button class="button button-secondary" type="button" id="cancelTransferCollectionEdit">取消</button></div></form>`;$("#cancelTransferCollectionEdit").onclick=()=>openAttendee(a.id);$("#transferCollectionEditForm").onsubmit=async event=>{event.preventDefault();Object.assign(a,Object.fromEntries(new FormData(event.currentTarget)));try{if(backend){const{error}=await backend.from("attendees").update({outbound_transfer_origin:a.outboundTransferOrigin||null,outbound_transfer_time:a.outboundTransferTime||null,outbound_transfer_notes:a.outboundTransferNotes||null,return_transfer_destination:a.returnTransferDestination||null,return_transfer_time:a.returnTransferTime||null,return_transfer_notes:a.returnTransferNotes||null}).eq("id",a.id);if(error)throw error;}addNotification("change",`${currentUser().name}更新了${a.name}的出发地（属地）接送信息`);saveState();renderAll();openAttendee(a.id);toast("属地接送信息已保存");}catch(error){toast(error.message||"保存失败","error");}};}

  function showTripEditor(a,{verification=false,segments=null}={}) {
    if(!canEditAttendeeData())return deny();
    const baseline=structuredClone(a);
    const targetSegments=(segments||verificationSegments(a)).filter(segment=>verificationSegments(a).includes(segment));
    const issues=targetSegments.flatMap(segment=>TravelVerification.currentIssues(a,segment));
    const notices=targetSegments.flatMap(segment=>verificationState(a,segment).notices);
    const fields=targetSegments.flatMap(segment=>Object.entries(TravelVerification.keys(segment)).map(([kind,key])=>{
      const segmentData=TravelVerification.snapshot(a,segment),number=segmentData.number;
      const transportType=["from","to"].includes(kind)?TravelFields.normalizeType(segmentData.departTransportType,number):"";
      const terminalMode=transportType==="HIGH_SPEED_RAIL"?"train":transportType==="PLANE"?"flight":"";
      const problems=issues.filter(issue=>issue.field===key);
      const rawValue=TravelVerification.getValue(a,key),value=["from","to"].includes(kind)?verificationTerminalLabel(rawValue,number,terminalMode):rawValue||"";
      const hint=problems.map(issue=>{
        const expected=issue.expected?(["from","to"].includes(kind)?verificationTerminalLabel(issue.expected,number,terminalMode):issue.expected):"";
        return issue.message+(expected?"；计划值："+expected:"");
      }).join("；");
      const issue=problems.length?`aria-invalid="true" aria-describedby="issue-${key}"`:"";
      let control;
      if(kind==="departTransportType")control=`<select name="${key}" ${issue}><option value="">请选择</option>${Object.entries(TravelFields.TYPES).map(([type,label])=>`<option value="${type}" ${rawValue===type?"selected":""}>${label}</option>`).join("")}</select>`;
      else if(["from","to"].includes(kind)&&key.startsWith("extra::"))control=`<input name="${key}" type="text" value="${escapeHtml(value)}" ${issue}>`;
      else if(/Station$/.test(key)){const side=key.startsWith("returnDepart")?"returnDepart":key.startsWith("returnArrive")?"returnArrive":key.startsWith("depart")?"depart":"arrive";control=`<select data-station-select="${side}" hidden></select><input data-station-input="${side}" hidden ${issue}>`;}
      else control=`<input name="${key}" type="${["date","arriveDate"].includes(kind)?"date":["departure","arrival"].includes(kind)?"time":"text"}" value="${escapeHtml(value)}" ${issue}>`;
      return `<label class="${problems.length?"travel-problem-field":""}">${escapeHtml(FIELD_LABELS[key]||key)}${control}${problems.length?`<small id="issue-${key}" class="travel-field-issue">⚠ ${escapeHtml(hint)}</small>`:""}</label>`;
    })).join("");
    const recheckNotice=verification?`<div class="verify-recheck-policy"><strong>重新核验遵循全局查询设置</strong><span>${loadSystemPreferences().variflightGlobalEnabled===true?"飞常准全局查询已开启；若本行已单独关闭，则不会调用飞常准。":"飞常准全局查询已关闭，本次仅做本地字段检查。"}</span></div>`:"";
    $("#attendeeDetail").innerHTML=`<div class="detail-head"><span class="kicker">EDIT TRAVEL</span><h2>修改 ${escapeHtml(a.name)} 的行程</h2><p>仅本次检出的异常字段标色；其他字段也可编辑。场站显示简称，保存及对外导出保留完整名称。</p></div><form class="detail-body" id="tripEditForm"><div class="risk-preview warning" role="status">${issues.length?"请检查下方标色字段。":"本次没有定位到具体异常字段。"}${escapeHtml([...new Set(notices)].join("；"))}</div><div class="trip-save-error lookup-error" role="alert"></div><div class="field-grid">${fields}</div>${recheckNotice}<div class="detail-actions"><button class="button button-primary" type="submit">${verification?"保存并重新核验":"保存人工修改"}</button><button class="button button-secondary" type="button" id="cancelEdit">取消</button></div></form>`;
    const form=$("#tripEditForm"),dialog=$("#attendeeDialog");
    bindJourneyForm(form,a);
    targetSegments.filter(segment=>segment.includes(":")).forEach(segment=>{const keys=TravelVerification.keys(segment),mode=form.elements[keys.departTransportType],from=form.elements[keys.from],to=form.elements[keys.to];if(!mode)return;const sync=clear=>{if(clear){from.value="";to.value="";}const local=mode.value==="LOCAL_ATTEND";from.disabled=to.disabled=local;if(local)from.value=to.value="";};mode.addEventListener("change",()=>sync(true));sync(false);});
    const locked=key=>isFieldLocked(a,TravelVerification.direction(key.includes("extra::")?targetSegments.find(segment=>Object.values(TravelVerification.keys(segment)).includes(key))||"outbound":key))||isFieldLocked(a,key);
    $$("input,select",form).forEach(input=>{if(input.name)input.disabled=locked(input.name);});
    if($$("input,select",form).some(input=>input.disabled))form.insertAdjacentHTML("afterbegin",'<div class="risk-preview warning">部分字段已按名单锁定规则锁定；异常标色本身不会锁定字段。</div>');
    $("#cancelEdit").onclick=()=>{if(verification){dialog.close();renderTravelVerificationResults();}else openAttendee(a.id);};
    form.onsubmit=async event=>{
      event.preventDefault();
      if(form.dataset.saving==="true")return;
      if(!canEditAttendeeData()||(verification&&!canManage()))return deny();
      form.dataset.saving="true";
      const buttons=$$("button",form);buttons.forEach(button=>button.disabled=true);
      const submit=form.querySelector('[type="submit"]');submit.textContent="正在保存…";
      const preventClose=event=>event.preventDefault();dialog.addEventListener("cancel",preventClose);
      $(".trip-save-error",form).textContent="";
      try {
        const fd=new FormData(form),allowPaidRecheck=verification&&loadSystemPreferences().variflightGlobalEnabled===true,draft={...a,customFields:{...(a.customFields||{}),_journeySegments:normalizedExtraJourneys(a.customFields?._journeySegments||[])}},changes=[],changedSegments=new Set();
        for(const segment of targetSegments){
          for(const [kind,key] of Object.entries(TravelVerification.keys(segment))){
            if(locked(key))continue;
            // Station controls load their city/type options asynchronously. If a
            // user saves before that work finishes, the temporarily unnamed
            // control is absent from FormData. Treat absence as "unchanged"
            // instead of clearing a valid itinerary and its verification proof.
            if(!fd.has(key))continue;
            let next=String(fd.get(key)??"").trim();
            if(["from","to"].includes(kind))next=TravelFields.officialStation(next,fd.get(TravelVerification.keys(segment).departTransportType)||TravelVerification.snapshot(a,segment).departTransportType,stationDictionary())||"";
            const previous=String(TravelVerification.getValue(a,key)||"");if(next!==previous){TravelVerification.setValue(draft,key,next);changes.push({field:key,label:FIELD_LABELS[key]||({date:"出发日期",departCity:"出发城市",departTransportType:"出行方式",from:"出发场站",arriveDate:"抵达日期",arriveCity:"抵达城市",to:"抵达场站",number:"航班 / 车次号",departure:"出发时间",arrival:"到达时间"}[kind]||key),before:previous||"未填写",after:next||"未填写"});changedSegments.add(segment);}
          }
        }
        TravelFields.applyLegacy(draft);
        // Keep persistent verified-cell highlights until the explicit reset action.
        draft.customFields._travelVerification={...(a.customFields?._travelVerification||{})};
        changedSegments.forEach(segment=>delete draft.customFields._travelVerification[segment]);
        if(changedSegments.size)refreshTravelApprovals(draft,changedSegments);
        await persistVerifiedAttendees([draft],{baseline,edit:true,operator:currentUser().name});
        Object.assign(a,draft);
        if(verification){await verifyTravelAttendees([draft],{allowPaid:allowPaidRecheck,selection:new Set(targetSegments.map(segment=>verificationSelectionKey(draft.id,segment))),disabledPaid:disabledVerificationFlightSegments});await persistVerifiedAttendees([draft]);}
        Object.assign(a,draft);
        if(changes.length)addNotification("change",`${currentUser().name}修改了${a.name}的行程，共${changes.length}个字段`,{attendeeName:a.name,changes});
        persistStateLocally();
        renderAll();renderTravelVerificationResults();
        const remaining=targetSegments.flatMap(segment=>TravelVerification.currentIssues(a,segment));
        if(verification&&remaining.length){showTripEditor(a,{verification:true,segments:targetSegments});toast("已保存并重新核验，请继续修改标色字段","error");}
        else{dialog.close();toast(verification?"已保存并重新核验":"已保存人工修改；变更的行程待重新核验");}
      }catch(error){
        $(".trip-save-error",form).textContent=`保存或重新核验未完成：${error.message}。请重试，当前未确认核验通过。`;
      }finally{
        dialog.removeEventListener("cancel",preventClose);
        form.dataset.saving="false";buttons.forEach(button=>button.disabled=false);submit.textContent=verification?"保存并重新核验":"保存人工修改";
      }
    };
  }

  function decideTravelApproval(id,segment="outbound",decision="approved") { if (!canEditAttendeeData()) return deny(); const a=state.attendees.find(item=>item.id===id);if(!a)return;const key=segment==="return"?"returnApproval":"outboundApproval";const reason=decision==="approved"?"符合会议例外审批要求":prompt(decision==="returned"?"请输入退回修改原因":"请输入不予批准原因");if(decision!=="approved"&&!reason)return;a[key]=decision==="approved"?"approved":"rejected";a.customFields={...(a.customFields||{}),_travelApprovalActions:{...(a.customFields?._travelApprovalActions||{}),[segment]:{decision,reason,operator:currentUser().name,at:new Date().toISOString()}}};syncAggregateApproval(a);const action=decision==="approved"?"审批通过":decision==="returned"?"退回修改":"不予批准";addNotification("approval",`${currentUser().name}将${a.name}的${segment==="return"?"返程":"去程"}行程${action}：${reason}`);saveState();renderAll();toast(`${segment==="return"?"返程":"去程"}行程已${action}`); }
  function deny() { toast("当前身份没有此操作权限", "error"); renderAll(); }

  function editTransport(id, type) {
    const a = state.attendees.find(item => item.id === id); const t = a.transport[type] || {}; const typeName = type === "pickup" ? "接机" : "送机";
    if(isFieldLocked(a,"transport"))return toast(`${a.name}的接送机字段已锁定`,"error");
    const pickup=type==="pickup",suggested=pickup?"":recommendedDropoffTime(a),rule=pickup?null:dropoffStationRule(a);
    const savedTime = !t.time || ["待设置","待分配"].includes(t.time) ? suggested : t.time;
    const currentMode = isStaffTransport(t) ? "staff" : "driver";
    $("#attendeeDetail").innerHTML = `<div class="detail-head"><span class="kicker" style="color:#e9d8f2">TRANSPORT</span><h2>${escapeHtml(a.name)} · ${typeName}</h2><p>实际场站：${escapeHtml(transportTerminal(a,type)||"行程尚未补全")}；单独修改后将退出原接送批次</p></div><form class="detail-body" id="transportEditForm"><div class="field-grid"><label class="span-2">安排类型<select name="mode" id="transportMode"><option value="staff" ${currentMode === "staff" ? "selected" : ""}>工作人员${pickup?"接机 / 接站":"送机 / 送站"}</option><option value="driver" ${currentMode === "driver" ? "selected" : ""}>独立司机接送</option></select></label><div class="span-2 driver-fields" id="staffFields"><div class="field-grid"><label>工作人员姓名<input name="staffName" value="${escapeHtml(t.staffName||"")}"></label><label>工作人员电话<input name="staffPhone" value="${escapeHtml(currentMode==="staff"?t.phone||"":"")}"></label>${pickup?`<label class="span-2">接机牌文字<input name="placard" value="${escapeHtml(t.placard||"")}"></label><label class="span-2 document-file-picker">接机牌样稿附件<input name="placardFile" type="file" accept="image/*,.pdf"><small>${escapeHtml(t.placardFileName||"支持图片或 PDF，最大 15MB")}</small></label>`:""}</div></div><div class="span-2 driver-fields" id="driverFields"><div class="field-grid"><label>司机姓名<input name="driver" value="${escapeHtml(currentMode === "driver" ? t.driver || "" : "")}"></label><label>司机电话<input name="driverPhone" value="${escapeHtml(currentMode === "driver" ? t.phone || "" : "")}"></label><label class="span-2">司机车牌号<input name="vehicle" value="${escapeHtml(currentMode === "driver" ? t.vehicle || "" : "")}"></label></div></div>${pickup?"":`<label>送机时间<input name="time" value="${escapeHtml(savedTime||"")}" placeholder="YYYY-MM-DD HH:mm" required></label><label>${currentMode==="staff"?"送机地点":"送机集合点"}<input name="point" value="${escapeHtml(t.point||"")}" required></label>`}</div>${pickup?`<div class="risk-preview">接机固定不维护时间和集合点，接送点位直接使用实际抵达场站。</div>`:`<div class="risk-preview ${rule?"ok":"warning"}">${rule?`✓ ${escapeHtml(rule.station)}提前 ${Number(rule.minutes)||0} 分钟；参考送机时间 ${escapeHtml(suggested||"待补全返程班次时间")}`:"未匹配当前场站规则，请人工填写送机时间。"} 人工保存后不会被规则变更覆盖。</div>`}<div class="detail-actions"><button class="button button-primary" type="submit">保存安排</button><button class="button button-secondary" type="button" id="cancelTransport">取消</button></div></form>`;
    const dialog = $("#attendeeDialog"); dialog.showModal();
    const form = $("#transportEditForm"); const mode = $("#transportMode"); const driverFields = $("#driverFields"); const staffFields=$("#staffFields");
    const toggleDriverFields = () => { const show = mode.value === "driver"; driverFields.classList.toggle("is-hidden", !show); staffFields.classList.toggle("is-hidden",show); $$('input', driverFields).forEach(input => input.required = show); $$('input',staffFields).forEach(input=>input.required=false); };
    mode.onchange = toggleDriverFields; toggleDriverFields(); $("#cancelTransport").onclick = () => dialog.close();
    form.onsubmit = async event => { event.preventDefault(); if(t.batchId&&!confirm("单独修改后该参会者将退出原接送批次，是否继续？"))return; const values=Object.fromEntries(new FormData(form));let fileMeta=null;try{fileMeta=pickup&&values.mode==="staff"?await uploadTransportPlacard(form.elements.placardFile?.files?.[0],a.id):null;}catch(error){return toast(error.message,"error");}const common={mode:values.mode,batchId:"",batchName:"",terminal:transportTerminal(a,type),time:pickup?"":values.time,point:pickup?"":values.point,timeSource:pickup?"none":"manual"};a.transport[type]=values.mode==="staff"?{...common,staffName:values.staffName,driver:"会务工作人员",phone:values.staffPhone,vehicle:"",placard:pickup?values.placard:"",placardFilePath:fileMeta?.path||t.placardFilePath||"",placardFileName:fileMeta?.name||t.placardFileName||"",placardFileSize:fileMeta?.size||t.placardFileSize||0}:{...common,staffName:"",driver:values.driver,phone:values.driverPhone,vehicle:values.vehicle,placard:"",placardFilePath:"",placardFileName:"",placardFileSize:0};addNotification("change", `${currentUser().name}更新了${a.name}的${typeName}安排`);saveState();dialog.close();renderAll();toast(`${typeName}安排已更新`); };
  }

  function isStaffTransport(item = {}) { return item.mode === "staff" || item.service_mode === "staff" || item.driver === "会务工作人员" || item.driver_name === "会务工作人员"; }
  function isFlightReturn(a) { return a.flight === "Y" && !/^[GDC]\d+/i.test(String(a.returnNo || "").trim()); }
  function transportTerminal(a,direction){return direction==="pickup"?(a.arriveStation||a.outTo||""):(a.returnDepartStation||a.returnFrom||"");}
  function transportDate(a,direction){return direction==="pickup"?(a.arriveDate||a.outDate||""):(a.returnDepartDate||a.returnDate||"");}
  function transportClock(a,direction){return direction==="pickup"?(a.outArrival||""):(a.returnDeparture||"");}
  function dropoffStationRule(a){const terminal=comparableStation(transportTerminal(a,"dropoff"));if(!terminal)return null;return(state.settings.transportStationRules||[]).find(rule=>{const candidate=comparableStation(rule.station);return candidate===terminal||candidate.includes(terminal)||terminal.includes(candidate);})||null;}
  function recommendedDropoffTime(a) {
    const rule=dropoffStationRule(a);const date=transportDate(a,"dropoff"),clock=transportClock(a,"dropoff");
    if (!rule || !date || !clock) return "";
    const departure = new Date(`${date}T${clock}:00`);
    if (Number.isNaN(departure.getTime())) return "";
    departure.setMinutes(departure.getMinutes() - Number(rule.minutes||0));
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
    if (projects.length===1) { const url=new URL(location.href); url.searchParams.set("event",projects[0].slug); history.replaceState(null,"",url); publicProjectConfig=projects[0]; applyPublicProject(projects[0]); submit.disabled=!projects[0].newRegistrationAllowed||!configuredPublicRegions(projects[0]).length; return; }
    $("#publicProjectName").textContent="请选择要报名的项目"; $("#publicRegistrationResult").innerHTML=`<div class="lookup-error">${escapeHtml(reason)}。请选择项目后再进入报名名单。</div>`;
    const selector=$("#publicProjectSelector"); selector.innerHTML=`<option value="">请选择项目</option>${projects.map(project=>`<option value="${escapeHtml(project.slug)}">${escapeHtml(project.name)}</option>`).join("")}`; selector.classList.remove("is-hidden"); selector.onchange=()=>{ if(!selector.value)return; const url=new URL(location.href); url.searchParams.set("event",selector.value); history.replaceState(null,"",url); publicProjectConfig=null; loadPublicProjectInfo(); }; submit.disabled=true;
  }

  function submitRegistration(event) {
    event.preventDefault(); if(!canEditAttendeeData())return toast("当前账号仅有查看权限，请由原始填报人修改或开启管理员编辑权限","error");if (state.locks.master) return toast("全名单已锁定，不能新增报名", "error");
    const data = Object.fromEntries(new FormData(event.currentTarget)); const customFields={};Object.keys(data).filter(key=>key.startsWith("custom__")).forEach(key=>{customFields[key.slice(8)]=data[key];delete data[key];});TravelFields.applyLegacy(data); data.arriveTransportType=data.departTransportType;data.returnArriveTransportType=data.returnDepartTransportType;data.phone = normalizePhone(data.phone);data.contactName=String(data.contactName||"").trim();data.contactMobile=normalizePhone(data.contactMobile); if (data.phone.length !== 11) return toast("请输入正确的 11 位手机号", "error");if(!isInternalMeeting()&&(!data.contactName||data.contactMobile.length!==11))return toast("请填写销售联系人姓名和正确的11位联系电话","error");
    if(isInternalMeeting()){data.attendeeType="内部员工";["city","hospital","department","title","hcpId","mslContact"].forEach(key=>data[key]="");}
    if (state.attendees.some(a => a.phone === data.phone)) return toast("该手机号已存在报名记录", "error");
    data.id = backend ? crypto.randomUUID() : `a-${Date.now()}`; data.ownerId = currentUser().role === "sales" ? currentUser().id : (data.ownerId || state.users.find(u => u.role === "sales")?.id || currentUser().id); refreshTravelApprovals(data); data.privacyLetterStatus="pending"; data.ticketStatus="pending"; data.customFields={...customFields,_journeySegments:collectExtraJourneys(event.currentTarget)}; data.createdAt = new Date().toISOString(); data.transport = { pickup: { driver: "待分配", phone: "—", vehicle: "待分配", time:"", point:"", terminal:transportTerminal(data,"pickup") }, dropoff: { driver: "待分配", phone: "—", vehicle: "待分配", time: recommendedDropoffTime(data), point:"",terminal:transportTerminal(data,"dropoff"),timeSource:recommendedDropoffTime(data)?"rule":"" } };
    state.attendees.unshift(data); addNotification("create", `${currentUser().name}新增报名：${data.name} · ${data.venue}${data.risks.length ? "（行程待审批）" : ""}`); saveState(); event.currentTarget.reset(); bindJourneyForm(event.currentTarget); renderAll(); toast(data.risks.length ? "报名已保存，异常行程已提交审批" : "报名已保存"); location.hash = "attendees";
  }

  async function submitPublicRegistration(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode=form.id==="publicManageForm"?"manage":"register";
    const result = mode==="manage"?$("#publicManageResult"):$("#publicRegistrationResult");
    const submit = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    if(!String(data.name||"").trim()||!String(data.employeeNo||"").trim()){result.innerHTML=`<div class="lookup-error">请填写姓名和员工编号。</div>`;return;}
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
    $("#publicRegistrantIdentity").textContent = [publicAuthSession.region,publicAuthSession.name,`员工编号 ${publicAuthSession.employeeNo}`].filter(Boolean).join(" · ");
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
    if(isInternalMeeting(publicProjectConfig))$$('.public-attendee-card-main small',list).forEach((summary,index)=>{const attendee=publicRegistrantAttendees[index];summary.textContent=`${attendee.customFields?.businessUnit||"BU 待填写"} · ${attendee.customFields?.internalPosition||"职位待填写"} · ${attendee.phone||"手机号待填写"}`;});
    $$('[data-edit-public-attendee]',list).forEach(button=>button.addEventListener("click",()=>openPublicAttendeeEditor(publicRegistrantAttendees.find(item=>item.id===button.dataset.editPublicAttendee))));
    $$('[data-cancel-public-attendee]',list).forEach(button=>button.addEventListener("click",()=>cancelPublicAttendee(button.dataset.cancelPublicAttendee)));
  }

  function openPublicAttendeeEditor(attendee = null) {
    if(!attendee&&!canOpenNewRegistration()&&window.APP_CONFIG?.mode!=="production")return toast("当前项目未开放新增报名","error");
    if(!attendee&&!publicProjectConfig?.newRegistrationAllowed&&window.APP_CONFIG?.mode==="production")return toast("当前项目已暂停新增报名","error");
    const form = $("#publicFullRegistrationForm");
    form.reset(); form.querySelectorAll("input,select,textarea").forEach(input=>input.disabled=false); form.querySelector('button[type="submit"]').classList.remove("is-hidden");
    publicEditingAttendeeId = attendee?.id || null;
    const aliases = { attendeeType:"attendeeType", name:"name", city:"city", hospital:"hospital", department:"department", title:"title", venue:"venue", sex:"sex", idNumber:"idNumber", phone:"phone", hcpId:"hcpId", accommodation:"accommodation", flight:"flight", region:"region", contactName:"contactName", contactMobile:"contactMobile", mslContact:"mslContact", remarks:"remarks", outNo:"outNo", outDeparture:"outDeparture", outArrival:"outArrival", returnDepartDate:"returnDepartDate", returnDepartCity:"returnDepartCity", returnDepartTransportType:"returnDepartTransportType", returnDepartStation:"returnDepartStation", returnArriveDate:"returnArriveDate", returnArriveCity:"returnArriveCity", returnArriveTransportType:"returnArriveTransportType", returnArriveStation:"returnArriveStation", returnDate:"returnDate", returnFrom:"returnFrom", returnTo:"returnTo", returnNo:"returnNo", returnDeparture:"returnDeparture", returnArrival:"returnArrival" };
    Object.entries(aliases).forEach(([field,key]) => { if (form.elements[field]) form.elements[field].value = attendee?.[key] ?? (field === "attendeeType" ? "HCP" : ""); });
    ["outboundTransferOrigin","outboundTransferTime","outboundTransferNotes","returnTransferDestination","returnTransferTime","returnTransferNotes"].forEach(field=>{if(form.elements[field])form.elements[field].value=attendee?.[field]||"";});
    form.elements.region.value = publicAuthSession.region; form.elements.contactName.value = attendee?.contactName||""; form.elements.contactMobile.value = attendee?.contactMobile||"";
    applyPublicTemplate(publicProjectConfig?.registrationTemplate, publicProjectConfig?.templateName, attendee?.customFields||{});
    applyPublicFieldConfig(publicProjectConfig?.fieldConfig || {});
    ["businessUnit","internalPosition","employeeNo","clothingSize"].forEach(key=>{const input=form.elements[`custom__${key}`];if(input)input.value=attendee?.customFields?.[key]||"";});
    applyMeetingTypeFields(form,publicProjectConfig||{});
    bindJourneyForm(form,attendee||{});
    const updateTransferVisibility=()=>{$$(".optional-transfer-section",form).forEach(section=>section.classList.toggle("is-hidden",!transferCollectionAllowed(form.elements.attendeeType.value,publicProjectConfig)));};updateTransferVisibility();form.elements.attendeeType.oninput=updateTransferVisibility;
    const locked=attendee?.businessStatus==="cancelled"||!!attendee?.rowLocked || !!publicProjectConfig?.masterLocked; form.querySelectorAll("input,select,textarea").forEach(input=>input.disabled=locked || input.readOnly); form.querySelectorAll("[data-add-journey],[data-remove-journey]").forEach(button=>button.disabled=locked); form.querySelector('button[type="submit"]').classList.toggle("is-hidden",locked);
    $("#publicEditorTitle").textContent=attendee ? `${locked ? "查看" : "修改"}参会人员：${attendee.name}` : "新增参会人员";
    $("#publicFullRegistrationResult").innerHTML=""; $("#publicAttendeeEditor").classList.remove("is-hidden");
    $("#publicAttendeeEditor").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function applyPublicProject(project = {}) {
    if (!project) return;
    document.title = "礼来会议管理平台";
    $("#publicProjectName").textContent=project.name || "参会服务";
    const dateText=project.startDate ? `${fmtDate(project.startDate)}${project.endDate && project.endDate !== project.startDate ? ` — ${fmtDate(project.endDate)}` : ""}` : "待公布";
    $("#publicProjectDates").textContent=dateText; $("#publicProjectVenues").textContent=(project.venues || []).map(normalizeVenueLabel).filter(Boolean).join(" / ") || "待公布"; $("#publicProjectClient").textContent=project.clientName || project.name || "待公布";
    $("#publicProjectDeadline").textContent=project.deadline ? new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(project.deadline)) : "以会务通知为准";
    const footer=$(".public-footer"); if (footer) footer.textContent = project.servicePhone ? `会务服务台 ${project.servicePhone} · 工作时间 08:00–21:00` : "会务服务台 · 工作时间 08:00–21:00";
    const venueSelect=$("#publicFullRegistrationForm").elements.venue;
    if (venueSelect && project.venues?.length) { const selected=normalizeVenueLabel(venueSelect.value); const venues=[...new Set(project.venues.map(normalizeVenueLabel).filter(Boolean))]; venueSelect.innerHTML=`<option value="">请选择</option>${venues.map(venue=>`<option>${escapeHtml(venue)}</option>`).join("")}`; venueSelect.value=venues.includes(selected) ? selected : ""; }
    const regions=configuredPublicRegions(project);["publicRegistrationForm","publicManageForm"].forEach(id=>{const form=$("#"+id);let control=form?.elements.region;if(!control)return;const selected=control.value;if(regions.length){if(control.tagName!=="SELECT"){const select=document.createElement("select");select.name="region";control.replaceWith(select);control=select;}control.required=true;control.innerHTML=`<option value="">请选择当前会议大区</option>${regions.map(region=>`<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join("")}`;control.value=regions.includes(selected)?selected:"";}else{if(control.tagName!=="INPUT"){const input=document.createElement("input");input.name="region";input.maxLength=50;control.replaceWith(input);control=input;}control.required=false;control.placeholder="大区待确认，可自行填写或暂不填写";control.value=selected||"";}control.disabled=false;const button=form.querySelector('button[type="submit"]');if(button)button.disabled=id==="publicRegistrationForm"&&!project.newRegistrationAllowed;});
    const registrationTab=$('[data-portal-tab="register"]');if(registrationTab){registrationTab.disabled=!project.newRegistrationAllowed;registrationTab.title=project.newRegistrationAllowed?"进入报名":"当前项目已暂停新增报名";}
    const registrationSubmit=$("#publicRegistrationForm")?.querySelector('button[type="submit"]');if(registrationSubmit)registrationSubmit.disabled=!project.newRegistrationAllowed;
    const currentPublicRoute=(location.hash||"#portal").slice(1);if(!project.newRegistrationAllowed&&["portal","register"].includes(currentPublicRoute)&&!publicAuthSession){history.replaceState(null,"",`${location.pathname}${location.search}#manage`);setPortalTab("manage");$("#publicManageResult").innerHTML=`<div class="lookup-error">当前项目已暂停新增报名；更改已报名和参会信息查询仍可正常使用。</div>`;}
    applyPublicTemplate(project.registrationTemplate,project.templateName,{});
  }

  function configuredPublicRegions(project={}) {
    const regions=Array.isArray(project?.fieldConfig?.quotaRegions)?project.fieldConfig.quotaRegions:[];
    return [...new Set(regions.map(region=>String(region||"").trim()).filter(region=>region&&region!=="未填写大区"))];
  }

  function applyPublicTemplate(template,name,customValues={}) {
    const form=$("#publicFullRegistrationForm"); if (!form) return;
    const columns=repairRegistrationTemplate(template?.columns?.length ? template : standardTemplate()).columns;
    const included=new Map(columns.filter(column=>!column.custom).map(column=>[column.key,column]));
    CORE_AUTH_FIELDS.forEach(key=>{ if(!included.has(key)) included.set(key,{key,required:true}); });
    JOURNEY_FORM_COLUMNS.forEach(column=>{if(!included.has(column.key))included.set(column.key,{...column,required:true});});
    $$('[data-template-field]',form).forEach(label=>{
      const column=included.get(label.dataset.templateField); const visible=!!column;
      label.dataset.templateVisible=String(visible);
      label.classList.toggle("is-hidden",!visible);
      $$('input,select,textarea',label).forEach(input=>{ input.required=visible && (CORE_AUTH_FIELDS.has(label.dataset.templateField)||!!column?.required); if(!visible&&!input.readOnly) input.value=""; });
    });
    $$('.public-form-section',form).forEach(section=>{ if(section.id!=="publicCustomFieldsSection") section.classList.toggle("is-hidden",!section.querySelector('[data-template-field]:not(.is-hidden),[data-journey-field]:not(.is-hidden)')); });
    const builtInCustom=new Set(["businessUnit","internalPosition","employeeNo","clothingSize"]);
    const custom=columns.filter(column=>column.custom&&!builtInCustom.has(column.key));
    $("#publicCustomFieldsSection").classList.toggle("is-hidden",!custom.length);
    $("#publicCustomFields").innerHTML=custom.map(column=>`<label>${escapeHtml(column.header)}${column.required?" *":""}<input name="custom__${escapeHtml(column.key)}" value="${escapeHtml(customValues[column.key]||"")}" ${column.required?"required":""} /></label>`).join("");
    $("#publicTemplateHint").textContent=name ? `当前项目模板：${name}` : "字段与当前项目报名模板一致";
  }

  function applyPublicFieldConfig(config = {}) {
    $$('[data-config-field]', $("#publicFullRegistrationForm")).forEach(label => {
      const visible = config[label.dataset.configField] !== false; label.dataset.configVisible=String(visible);label.classList.toggle("is-hidden", !visible);
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
    const details = Object.fromEntries(new FormData(form)); TravelFields.applyLegacy(details);details.arriveTransportType=details.departTransportType;details.returnArriveTransportType=details.returnDepartTransportType;details.journeySegments=collectExtraJourneys(form);
    details.customFields={}; Object.keys(details).filter(key=>key.startsWith("custom__")).forEach(key=>{ details.customFields[key.slice(8)]=details[key]; delete details[key]; });
    details.phone = normalizePhone(details.phone); details.region=publicAuthSession.region; details.contactName=String(details.contactName||"").trim();details.contactMobile=normalizePhone(details.contactMobile);
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
      const execution=label==="接机"?`<div><small>实际抵达场站</small><strong>${escapeHtml(t.terminal||trip.to||"待公布")}</strong></div>${t.placard?`<div><small>接机牌</small><strong>${escapeHtml(t.placard)}</strong></div>`:""}`:`<div><small>送机时间</small><strong>${escapeHtml(displayTime(t.time||t.service_time))}</strong></div><div><small>送机地点 / 集合点</small><strong>${escapeHtml(t.point||t.meeting_point||"待公布")}</strong></div><div><small>返程出发场站</small><strong>${escapeHtml(t.terminal||trip.from||"待公布")}</strong></div>`;
      return `<div class="result-card"><h3>${label} · ${escapeHtml(trip.number||"待公布")}</h3><p>${escapeHtml(trip.from||"")} → ${escapeHtml(trip.to||"")} · ${escapeHtml(trip.date||"")}</p><div class="result-route"><div><small>工作人员 / 司机</small><strong>${escapeHtml(driver)}</strong></div><div><small>车辆</small><strong>${escapeHtml(vehicle)}</strong></div>${execution}</div></div>`;
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

  async function saveSettings(event) {
    event.preventDefault(); if (!canManage()) return deny(); const data = Object.fromEntries(new FormData(event.currentTarget));
    const button=event.currentTarget.querySelector('button[type="submit"]');
    const splitList=value=>[...new Set(String(value||"").split(/[、,，\n]+/).map(item=>item.trim()).filter(Boolean))];
    const pairingPriorities=[data.pairingPriority1,data.pairingPriority2,data.pairingPriority3,data.pairingPriority4].filter(Boolean);if(!isInternalMeeting()&&new Set(pairingPriorities).size!==4)return toast("四级拼住匹配条件不能重复，请重新选择","error");
    const stationNames=new FormData(event.currentTarget).getAll("transportRuleStation").map(value=>String(value).trim());const stationMinutes=new FormData(event.currentTarget).getAll("transportRuleMinutes");const transportStationRules=stationNames.map((station,index)=>({station,minutes:Math.max(0,Number(stationMinutes[index])||0)})).filter(rule=>rule.station);if(new Set(transportStationRules.map(rule=>comparableStation(rule.station))).size!==transportStationRules.length)return toast("同一场站不能重复配置，请合并后保存","error");
    Object.assign(state.settings,{ eventName:data.eventName, clientName:data.clientName, startDate:data.startDate, endDate:data.endDate, deadline:data.deadline, capacity:Number(data.capacity)||120, servicePhone:data.servicePhone, transportStationRules, transportGroupMinutes:Math.min(180,Math.max(10,Number(data.transportGroupMinutes)||30)), venues:[...new Set(String(data.venues||"").split(/[、,，\s]+/).map(normalizeVenueLabel).filter(Boolean))], quotaRegions:splitList(data.registrationRegions), mismatchRule:!!data.mismatchRule, departureRule:false, travelApprovalRules:{timeEnabled:!!data.approvalTimeRule,earliestArrival:data.earliestArrival||"",latestDeparture:data.latestDeparture||"",tourismEnabled:!!data.tourismCityRule,tourismCities:splitList(data.tourismCities),mismatchEnabled:!!data.mismatchRule}, roomingRules:isInternalMeeting()?{...(state.settings.roomingRules||{}),mode:"manual"}:{singleTitles:splitList(data.singleRoomTitles),twinSingleKeywords:splitList(data.twinSingleKeywords),defaultType:data.defaultRoomType||"shared",pairingPriorities,conflictApproval:!!data.roomConflictApproval}, fieldConfig:{...state.settings.fieldConfig,title:!!data.fieldTitle,hcpId:!!data.fieldHcpId,accommodation:!!data.fieldAccommodation,flight:!!data.fieldFlight,mslContact:!!data.fieldMslContact,remarks:!!data.fieldRemarks,clothingSize:!!data.fieldClothingSize,approvalEmailNotifications:!!data.approvalEmailNotifications,internalRoomingMode:"manual"} });
    state.settings.transferCollectionEnabled=!!data.transferCollectionEnabled;state.settings.transferCollectionRoles=[...new Set(new FormData(event.currentTarget).getAll("transferCollectionRole").map(String))];
    state.attendees.forEach(attendee=>refreshTravelApprovals(attendee));
    const project=currentProject(); Object.assign(project,{name:state.settings.eventName,clientName:state.settings.clientName,startDate:state.settings.startDate,endDate:state.settings.endDate,brandColor:state.settings.brandColor});
    button.disabled=true;
    try{
      await persistMeetingSettings({
        name:state.settings.eventName,
        client_name:state.settings.clientName||null,
        start_date:state.settings.startDate||null,
        end_date:state.settings.endDate||null,
        deadline:state.settings.deadline||null,
        capacity:state.settings.capacity,
        service_phone:state.settings.servicePhone||null,
        venues:state.settings.venues||[],
        check_city_mismatch:!!state.settings.mismatchRule,
        transport_group_minutes:state.settings.transportGroupMinutes||30,
        transfer_collection_enabled:!!state.settings.transferCollectionEnabled,
        transfer_collection_roles:state.settings.transferCollectionRoles||[],
        field_config:{
          title:!!state.settings.fieldConfig.title,
          hcpId:!!state.settings.fieldConfig.hcpId,
          accommodation:!!state.settings.fieldConfig.accommodation,
          flight:!!state.settings.fieldConfig.flight,
          mslContact:!!state.settings.fieldConfig.mslContact,
          remarks:!!state.settings.fieldConfig.remarks,
          clothingSize:!!state.settings.fieldConfig.clothingSize,
          approvalEmailNotifications:!!state.settings.fieldConfig.approvalEmailNotifications,
          internalRoomingMode:"manual",
          travelApprovalRules:state.settings.travelApprovalRules||{},
          roomingRules:state.settings.roomingRules||{},
          transportStationRules:state.settings.transportStationRules||[]
        }
      });
      addNotification("change", `${currentUser().name}更新了当前项目的行程审批与分房规则`);persistStateLocally();populateProjects();renderAll();toast("项目设置已保存；如需应用新分房规则，请在分房管理重新执行自动分房");
    }catch(error){
      if(settingsConflict(error)){await loadBackendState(backendMeetingId);populateProjects();renderAll();toast("会议设置已被其他页面或账号更新，已加载最新内容，请重新确认后保存","error");}
      else toast(`项目设置保存失败：${error.message||"未知错误"}`,"error");
    }finally{button.disabled=false;}
  }

  function copyRegistrationLink() { const url = publicProjectUrl(); navigator.clipboard?.writeText(url).then(() => toast("参会服务链接已复制")).catch(() => toast(url)); }
  function renderQr() { const box = $("#qrCanvas"); if (!box) return; const url = publicProjectUrl(); box.innerHTML = ""; if (window.QRCode) new QRCode(box, { text:url, width:256, height:256, colorDark:"#000000", colorLight:"#ffffff", correctLevel:QRCode.CorrectLevel.M }); else box.innerHTML = `<button class="text-button" type="button">复制参会服务链接</button>`; box.querySelector("button")?.addEventListener("click",copyRegistrationLink); $$("[data-current-public-link]").forEach(link=>link.href=url); }
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
    const transferDirect=[[/去程属地送站出发地点|属地送站出发地点|去程送站出发地点|接送出发地点|outboundtransferorigin/,"outboundTransferOrigin"],[/去程属地预约送站时间|属地预约送站时间|预约送站时间|outboundtransfertime/,"outboundTransferTime"],[/去程属地送站备注|属地送站备注|去程送站备注|outboundtransfernotes/,"outboundTransferNotes"],[/返程属地接站送达目的地|属地接站送达目的地|返程接站送达目的地|送达目的地|returntransferdestination/,"returnTransferDestination"],[/返程属地预估接站时间|属地预估接站时间|预估接站时间|returntransfertime/,"returnTransferTime"],[/返程属地接站备注|属地接站备注|返程接站备注|returntransfernotes/,"returnTransferNotes"]];for(const[pattern,key]of transferDirect)if(pattern.test(text))return key;
    const journeyDirect=[
      [/返程出发日期|returndepartdate/,"returnDepartDate"],[/返程出发城市|returndepartcity/,"returnDepartCity"],[/返程出发出行方式|返程出行方式|返程出发方式|returndeparttransporttype/,"returnDepartTransportType"],[/返程出发场站|returndepartstation/,"returnDepartStation"],
      [/返程抵达日期|returnarrivedate/,"returnArriveDate"],[/返程抵达城市|returnarrivecity/,"returnArriveCity"],[/返程抵达出行方式|返程抵达方式|returnarrivetransporttype/,"returnArriveTransportType"],[/返程抵达场站|returnarrivestation/,"returnArriveStation"],
      [/去程出发日期/,"departDate"],[/去程出发城市/,"departCity"],[/去程出行方式|去程出发方式/,"departTransportType"],[/去程出发场站/,"departStation"],
      [/去程抵达日期/,"arriveDate"],[/去程抵达城市/,"arriveCity"],[/去程抵达方式|去程抵达出行方式/,"arriveTransportType"],[/去程抵达场站/,"arriveStation"],
      [/^出发日期$|departdate/,"departDate"],[/^出发城市$|departcity/,"departCity"],[/^出发出行方式$|departtransporttype/,"departTransportType"],[/^出发场站$|departstation/,"departStation"],
      [/^抵达日期$|arrivedate/,"arriveDate"],[/^抵达城市$|arrivecity/,"arriveCity"],[/^抵达出行方式$|arrivetransporttype/,"arriveTransportType"],[/^抵达场站$|arrivestation/,"arriveStation"],
    ];
    for(const[pattern,key]of journeyDirect)if(pattern.test(text))return key;
    const direct = [
      [/所属bu|businessunit/,"businessUnit"],[/员工号|员工编号|employeeno/,"employeeNo"],[/职位|position/,"internalPosition"],[/衣服尺寸|服装尺寸|clothingsize/,"clothingSize"],[/参会者类别|attendeetype/,"attendeeType"],[/销售联系人手机|contactmobile/,"contactMobile"],[/销售联系人姓名|contactname/,"contactName"],[/客户编号|hcpid/,"hcpId"],[/身份证|护照|passport|idpassport/,"idNumber"],[/手机号|mobilephone/,"phone"],[/客户姓名|姓名|name/,"name"],[/医院|连锁|hospital|chain/,"hospital"],[/科室|门店|department|store/,"department"],[/职称|title/,"title"],[/会场|venue/,"venue"],[/性别|sex/,"sex"],[/住宿安排单间标间|房型|roomtype/,"roomType"],[/住宿需求|住宿|accommodation/,"accommodation"],[/是否航空|flightyn/,"flight"],[/返回日期|returndate/,"returnDate"],[/大区|region/,"region"],[/msl/,"mslContact"],[/备注|remarks?/,"remarks"],
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
    const used=new Set();
    return {version:1,columns:headers.map((raw,index)=>{
      const header=cleanCell(raw)||`未命名字段 ${index+1}`;
      let key=inferTemplateKey(header,index,headers.length);
      if (key && key!=="sequence" && used.has(key)) key="";
      if (key) used.add(key);
      const custom=!key; if (custom) key=`custom_${index}_${normalizeHeader(header).slice(0,18)||"field"}`;
      return {header,key,required:/\*/.test(header),custom};
    })};
  }
  function repairRegistrationTemplate(template={}) {
    const source=Array.isArray(template?.columns)?template.columns:[];
    if(!source.length)return{...(template||{}),version:template?.version||1,columns:[]};
    const inferred=templateFromHeaders(source.map(column=>column?.header||""));
    const columns=source.map((column,index)=>{
      const repaired=inferred.columns[index];
      const preserveExisting=repaired.custom===true&&String(column?.key||"").trim()!=="";
      return{...column,key:preserveExisting?column.key:repaired.key,custom:preserveExisting?column.custom===true:repaired.custom,required:column?.required===true||repaired.required===true};
    });
    return{...(template||{}),version:template?.version||1,columns};
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
      let newStoragePath="";const previousStoragePath=state.settings.templateStoragePath||"";
      if(backend&&backendMeetingId){const extension=(file.name.match(/\.(xlsx|xls|csv)$/i)?.[0]||".xlsx").toLowerCase();newStoragePath=`${backendMeetingId}/${crypto.randomUUID()}${extension}`;const uploaded=await backend.storage.from("registration-template-files").upload(newStoragePath,file,{contentType:file.type||"application/octet-stream",upsert:false});if(uploaded.error)throw uploaded.error;const{error}=await backend.rpc("save_project_registration_template",{p_meeting_id:backendMeetingId,p_template_name:file.name,p_template:template,p_storage_path:newStoragePath});if(error){await backend.storage.from("registration-template-files").remove([newStoragePath]);throw error;}if(previousStoragePath&&previousStoragePath!==newStoragePath)await backend.storage.from("registration-template-files").remove([previousStoragePath]);if(venueOptions.length)await persistMeetingSettings({venues:state.settings.venues});}
      state.settings.templateName=file.name;state.settings.templateStoragePath=newStoragePath;state.settings.templateIsSystemDefault=false;state.settings.registrationTemplate=template;state.settings.templateImported=true;const project=currentProject();if(project)project.templateImported=true;
      addNotification("change",`${currentUser().name}为当前项目启用了报名模板：${file.name}`); saveState(); renderSettings(); toast(`模板已启用，共识别 ${headers.length} 列`);
    } catch(error) { toast(error.message||"模板读取失败","error"); }
    finally { $("#projectTemplateFile").value=""; }
  }
  async function resetProjectTemplate() {
    if (!canManage()) return;
    if(state.settings.templateIsSystemDefault||!state.settings.templateImported)return toast("系统内置默认模板不允许删除","error");
    if(state.settings.registrationOpen)return toast("请先关闭报名开关，再删除模板","error");
    try{let storagePath=state.settings.templateStoragePath||"";if(backend){const status=await backend.rpc("get_project_registration_template_delete_status",{p_meeting_id:backendMeetingId});if(status.error)throw status.error;if(status.data?.referenced)return toast("该模板已被报名数据使用，不允许删除","error");if(status.data?.system_default)return toast("系统内置默认模板不允许删除","error");storagePath=status.data?.storage_path||storagePath;}else if(state.attendees.length)return toast("该模板已被报名数据使用，不允许删除","error");if(!confirm("确认删除该报名模板？删除后模板文件不可恢复"))return;if(backend){const removed=await backend.rpc("remove_project_registration_template",{p_meeting_id:backendMeetingId});if(removed.error)throw removed.error;storagePath=removed.data||storagePath;if(storagePath){const deleted=await backend.storage.from("registration-template-files").remove([storagePath]);if(deleted.error)throw new Error(`模板记录已删除，但原始文件清理失败：${deleted.error.message}`);}}state.settings.templateName="";state.settings.templateStoragePath="";state.settings.templateIsSystemDefault=false;state.settings.registrationTemplate={version:1,columns:[]};state.settings.templateImported=false;const project=currentProject();if(project)project.templateImported=false;saveState();renderSettings();renderProjects();toast("报名模板已删除");}catch(error){toast(error.message||"模板删除失败","error");}
  }
  async function removeProjectTemplateAttachment() {
    if (!canManage()) return;
    if(state.settings.templateIsSystemDefault)return toast("系统内置默认模板没有可删除附件","error");
    if(!state.settings.templateImported||(!state.settings.templateName&&!state.settings.templateStoragePath))return toast("当前没有可删除的报名模板附件","error");
    if(!confirm("确认删除该报名模板附件？删除后原始文件不可恢复；已生成的报名字段、报名开关和现有报名数据将全部保留"))return;
    try{
      let storagePath=state.settings.templateStoragePath||"";let cleanupWarning="";
      if(backend){const removed=await backend.rpc("remove_project_registration_template_attachment",{p_meeting_id:backendMeetingId});if(removed.error)throw removed.error;storagePath=removed.data||storagePath;if(storagePath){const deleted=await backend.storage.from("registration-template-files").remove([storagePath]);if(deleted.error)cleanupWarning=`；原始存储文件清理失败，请联系超级管理员：${deleted.error.message}`;}}
      state.settings.templateName="";state.settings.templateStoragePath="";
      addNotification("change",`${currentUser().name}删除了当前项目的报名模板附件，报名字段配置和历史报名数据已保留`);saveState();renderSettings();
      toast(`报名模板附件已删除，报名字段和历史数据已保留${cleanupWarning}`,cleanupWarning?"error":undefined);
    }catch(error){toast(error.message||"模板附件删除失败","error");}
  }
  async function downloadProjectTemplate(){
    const columns=columnsWithJourneyFields(meetingTemplateColumns());
    const headers=columns.map(column=>column.header);const example=columns.map(column=>/TransportType$/.test(column.key)?"飞机":"");
    if(window.XLSX){const ws=XLSX.utils.aoa_to_sheet([headers,example]);ws["!cols"]=headers.map(header=>({wch:Math.max(14,Math.min(28,String(header).length+4))}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"报名模板");try{await writeStyledWorkbook(wb,`${state.settings.slug||"会议"}-报名模板-含完整往返行程.xlsx`);toast("报名模板已按统一格式下载，已包含全部16个往返行程字段");}catch(error){toast(`模板下载失败：${error.message}`,"error");}}
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
      const headerIndex=rows.findIndex(row=>row.some(cell=>/(客户)?姓名|name/i.test(cleanCell(cell)))&&row.some(cell=>/手机号|mobile/i.test(cleanCell(cell))));
      if (headerIndex<0 || (rows[headerIndex]||[]).length<20) throw new Error("没有识别到报名模板表头，请使用礼来32列新版或原31列报名表模板");
      const importColumns=templateFromHeaders(rows[headerIndex]||[]).columns;const headerMap=Object.fromEntries(importColumns.map((column,index)=>[column.key,index]));
      const seen=new Set();
      pendingImportRows=rows.slice(headerIndex+1).filter(row=>row.slice(1).some(value=>cleanCell(value))).map((row,index)=>buildImportRow(row,headerIndex+index+2,seen,headerMap));
      if (!pendingImportRows.length) throw new Error("名单中没有可读取的参会者数据");
      renderImportPreview(file.name);
    } catch (error) { preview.innerHTML=`<div class="lookup-error">${escapeHtml(error.message||"文件读取失败")}</div>`; }
  }

  function buildImportRow(row, sheetRow, seen, headerMap={}) {
    const phone=normalizePhone(Number.isInteger(headerMap.phone)?row[headerMap.phone]:row[10]); const contactMobile=normalizePhone(Number.isInteger(headerMap.contactMobile)?row[headerMap.contactMobile]:row[28]); const existing=state.attendees.find(item=>normalizePhone(item.phone)===phone);
    const matchedOwner=state.users.find(user=>user.role==="sales"&&contactMobile&&normalizePhone(user.phone)===contactMobile) || state.users.find(user=>user.role==="sales"&&cleanCell(row[27])&&user.name===cleanCell(row[27]));
    const parsedTravel={outDate:excelDate(row[14]),outDeparture:excelTime(row[18]),outArrival:excelTime(row[19]),returnDate:excelDate(row[20]),returnDeparture:excelTime(row[24]),returnArrival:excelTime(row[25])};
    const outNumber=cleanCell(row[17]),importType=TravelFields.normalizeType(/本地参会/u.test([row[15],row[16],row[17]].join(""))?"本地参会":yesNo(row[13])==="Y"?"飞机":"高铁",outNumber);
    const departStation=importType==="LOCAL_ATTEND"?null:TravelFields.officialStation(normalizeTerminal(cleanCell(row[15]),outNumber),importType,stationDictionary());
    const arriveStation=importType==="LOCAL_ATTEND"?null:TravelFields.officialStation(normalizeTerminal(cleanCell(row[16]),outNumber),importType,stationDictionary());
    const returnNumber=cleanCell(row[23]),returnType=TravelFields.normalizeType(/本地参会/u.test([row[21],row[22],row[23]].join(""))?"本地参会":/^[GDCZTKYSL]\d+/i.test(returnNumber)?"高铁":"飞机",returnNumber);
    const returnDepartStation=returnType==="LOCAL_ATTEND"?null:TravelFields.officialStation(normalizeTerminal(cleanCell(row[21]),returnNumber),returnType,stationDictionary());
    const returnArriveStation=returnType==="LOCAL_ATTEND"?null:TravelFields.officialStation(normalizeTerminal(cleanCell(row[22]),returnNumber),returnType,stationDictionary());
    const travelNotes=[["去程日期",row[14],parsedTravel.outDate],["去程出发时间",row[18],parsedTravel.outDeparture],["去程抵达时间",row[19],parsedTravel.outArrival],["返程日期",row[20],parsedTravel.returnDate],["返程出发时间",row[24],parsedTravel.returnDeparture],["返程抵达时间",row[25],parsedTravel.returnArrival]].filter(([,raw,parsed])=>cleanCell(raw)&&!parsed).map(([label,raw])=>`${label}：${cleanCell(raw)}`);
    const importedRemarks=[cleanCell(row[30]),...travelNotes].filter(Boolean).join("；"); const customFields={...(existing?.customFields||{})}; if(travelNotes.length)customFields._importTravelNotes=travelNotes;const importedRoomType=normalizeRoomType(row[31]);if(importedRoomType)customFields.roomType=importedRoomType;
    const attendee={
      id:existing?.id || (backend ? crypto.randomUUID() : `a-${Date.now()}-${sheetRow}`), ownerId:matchedOwner?.id || existing?.ownerId || currentUser().id,
      attendeeType:cleanCell(row[1])||"HCP", name:cleanCell(row[2]), city:cleanCell(row[3]), hospital:cleanCell(row[4]), department:cleanCell(row[5]), title:cleanCell(row[6]), venue:normalizeVenueLabel(row[7]), sex:cleanCell(row[8]), idNumber:cleanCell(row[9]), phone, hcpId:cleanCell(row[11]), accommodation:yesNo(row[12]), flight:yesNo(row[13],/^[GDC]\d+/i.test(cleanCell(row[17]))?"N":"Y"),
      departDate:parsedTravel.outDate,departCity:TravelFields.cityForStation(departStation||cleanCell(row[15]),importType,stationDictionary()),departTransportType:importType,departStation,
      arriveDate:parsedTravel.outDate,arriveCity:TravelFields.cityForStation(arriveStation||cleanCell(row[16]),importType,stationDictionary()),arriveTransportType:importType,arriveStation,
      returnDepartDate:parsedTravel.returnDate,returnDepartCity:TravelFields.cityForStation(returnDepartStation||cleanCell(row[21]),returnType,stationDictionary()),returnDepartTransportType:returnType,returnDepartStation,
      returnArriveDate:parsedTravel.returnDate,returnArriveCity:TravelFields.cityForStation(returnArriveStation||cleanCell(row[22]),returnType,stationDictionary()),returnArriveTransportType:returnType,returnArriveStation,
      outDate:parsedTravel.outDate,outFrom:departStation||TravelFields.cityForStation(cleanCell(row[15]),importType,stationDictionary()),outTo:arriveStation||TravelFields.cityForStation(cleanCell(row[16]),importType,stationDictionary()),outNo:outNumber,outDeparture:parsedTravel.outDeparture,outArrival:parsedTravel.outArrival,returnDate:parsedTravel.returnDate,returnFrom:normalizeTerminal(cleanCell(row[21]),cleanCell(row[23])),returnTo:normalizeTerminal(cleanCell(row[22]),cleanCell(row[23])),returnNo:cleanCell(row[23]),returnDeparture:parsedTravel.returnDeparture,returnArrival:parsedTravel.returnArrival,region:cleanCell(row[26]),contactName:cleanCell(row[27]),contactMobile,mslContact:cleanCell(row[29]),remarks:importedRemarks,customFields,privacyLetterStatus:normalizePrivacyStatus(existing?.privacyLetterStatus),privacyLetterFilePath:existing?.privacyLetterFilePath||"",privacyLetterFileName:existing?.privacyLetterFileName||"",privacyLetterFileSize:existing?.privacyLetterFileSize||0,privacyLetterUploadedAt:existing?.privacyLetterUploadedAt||"",privacyLetterUploadedBy:existing?.privacyLetterUploadedBy||null,ticketStatus:existing?.ticketStatus||"pending",createdAt:existing?.createdAt||new Date().toISOString(),transport:existing?.transport||{pickup:{driver:"待分配",phone:"—",vehicle:"待分配",time:"待设置",point:"待设置"},dropoff:{driver:"待分配",phone:"—",vehicle:"待分配",time:"待设置",point:"会议酒店大堂"}},
    };
    const errors=[];
    const importedValue=key=>Number.isInteger(headerMap[key])?row[headerMap[key]]:undefined;
    ["name","city","hospital","department","title","venue","sex","idNumber","phone","hcpId","accommodation","flight","region","contactName","contactMobile","mslContact","remarks"].forEach(key=>{if(importedValue(key)!==undefined)attendee[key]=key==="phone"||key==="contactMobile"?normalizePhone(importedValue(key)):key==="venue"?normalizeVenueLabel(importedValue(key)):cleanCell(importedValue(key));});
    Object.keys(headerMap).filter(key=>key.startsWith("custom_")||["businessUnit","internalPosition","employeeNo","clothingSize"].includes(key)).forEach(key=>{const value=cleanCell(importedValue(key));if(value||customFields[key]===undefined)customFields[key]=value;});
    Object.assign(attendee,{outboundTransferOrigin:cleanCell(importedValue("outboundTransferOrigin"))||existing?.outboundTransferOrigin||"",outboundTransferTime:cleanCell(importedValue("outboundTransferTime"))||existing?.outboundTransferTime||"",outboundTransferNotes:cleanCell(importedValue("outboundTransferNotes"))||existing?.outboundTransferNotes||"",returnTransferDestination:cleanCell(importedValue("returnTransferDestination"))||existing?.returnTransferDestination||"",returnTransferTime:cleanCell(importedValue("returnTransferTime"))||existing?.returnTransferTime||"",returnTransferNotes:cleanCell(importedValue("returnTransferNotes"))||existing?.returnTransferNotes||""});
    for(const side of ["depart","arrive","returnDepart","returnArrive"]){
      const dateKey=`${side}Date`,cityKey=`${side}City`,typeKey=`${side}TransportType`,stationKey=`${side}Station`;
      if(importedValue(dateKey)!==undefined)attendee[dateKey]=excelDate(importedValue(dateKey));
      if(importedValue(cityKey)!==undefined)attendee[cityKey]=TravelFields.normalizeCity(importedValue(cityKey));
      if(importedValue(typeKey)!==undefined){const rawType=cleanCell(importedValue(typeKey));const normalizedType=TravelFields.normalizeType(rawType);if(rawType&&!/^(飞机|高铁|本地参会|PLANE|HIGH_SPEED_RAIL|LOCAL_ATTEND)$/i.test(rawType))errors.push(`${FIELD_LABELS[typeKey]}值无效：${rawType}`);attendee[typeKey]=normalizedType;}
      if(importedValue(stationKey)!==undefined)attendee[stationKey]=attendee[typeKey]==="LOCAL_ATTEND"?null:TravelFields.officialStation(importedValue(stationKey),attendee[typeKey],stationDictionary());
    }
    TravelFields.applyLegacy(attendee);
    if (!attendee.name) errors.push("缺少姓名"); if (phone.length!==11) errors.push("手机号格式错误"); if(isInternalMeeting()){if(!attendee.region)errors.push("缺少大区");if(!attendee.customFields?.businessUnit)errors.push("缺少所属BU");if(!attendee.customFields?.internalPosition)errors.push("缺少职位");if(!attendee.customFields?.employeeNo)errors.push("缺少员工号");}else{if (!attendee.idNumber) errors.push("缺少证件号"); if (!attendee.hcpId) errors.push("缺少HCP ID");}
    if (phone&&seen.has(phone)) errors.push("文件内手机号重复"); if (phone) seen.add(phone); if (existing&&isLocked(existing)) errors.push("已有记录已锁定");
    refreshTravelApprovals(attendee);
    if (!existing) { attendee.transport.pickup.time=""; attendee.transport.pickup.point="";attendee.transport.pickup.terminal=transportTerminal(attendee,"pickup"); attendee.transport.dropoff.time=recommendedDropoffTime(attendee)||"";attendee.transport.dropoff.terminal=transportTerminal(attendee,"dropoff");attendee.transport.dropoff.timeSource=attendee.transport.dropoff.time?"rule":""; }
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
        const transportRows=valid.flatMap(({attendee})=>["pickup","dropoff"].map(direction=>{const t=attendee.transport?.[direction]||{};return{attendee_id:attendee.id,direction,driver_name:t.driver||null,staff_name:t.staffName||null,driver_phone:t.phone||null,vehicle:t.vehicle||null,service_time:direction==="pickup"?null:parseServiceTime(t.time),meeting_point:direction==="pickup"?null:(t.point||null),service_mode:t.mode||null,batch_id:t.batchId||null,batch_name:t.batchName||null,terminal:transportTerminal(attendee,direction)||null,placard:direction==="pickup"?(t.placard||null):null,placard_file_path:direction==="pickup"?(t.placardFilePath||null):null,placard_file_name:direction==="pickup"?(t.placardFileName||null):null,placard_file_size:direction==="pickup"?(t.placardFileSize||null):null,capacity:t.capacity||null,notes:t.notes||null,time_strategy:t.timeStrategy||null,time_source:t.timeSource||null};}));
        if(transportRows.length){const transportResult=await backend.from("transports").upsert(transportRows,{onConflict:"attendee_id,direction"});if(transportResult.error)throw transportResult.error;}
        await loadBackendState(backendMeetingId);
      } else {
        valid.forEach(({attendee})=>{const index=state.attendees.findIndex(item=>item.id===attendee.id);if(index>=0)state.attendees[index]=attendee;else state.attendees.unshift(attendee);});
      }
      const added=valid.filter(row=>row.status==="new").length; const updated=valid.length-added; addNotification("create",`${currentUser().name}导入线下名单：新增${added}人，更新${updated}人`);
      persistStateLocally(); pendingImportRows=[]; $("#importDialog").close(); renderAll(); toast(backend?`已保存到云端：新增${added}人，更新${updated}人`:`已导入：新增${added}人，更新${updated}人`);
    } catch(error) {
      const message=error?.message||"云端保存失败"; button.disabled=false; button.textContent=originalLabel;
      $("#importPreview").insertAdjacentHTML("afterbegin",`<div class="lookup-error import-save-error">名单尚未保存，请勿刷新：${escapeHtml(message)}</div>`); toast(`导入失败：${message}`,"error");
    }
  }

  const SYSTEM_PREFS_KEY="lilly-meeting-system-preferences-v1";
  function loadSystemPreferences(){try{return{theme:"light",brandColor:"#d52b1e",density:"comfortable",backupInterval:7,variflightDailyLimit:5,variflightUnlimited:false,variflightGlobalEnabled:false,maxConcurrentDevices:2,mailDeliveryConfigured:false,tourismCities:DEFAULT_TOURISM_CITIES,titles:["主任医师","副主任医师","主治医师","住院医师","主任药师","副主任药师"],stationDictionary:TravelFields.DEFAULT_DICTIONARY,cityAliases:[],...(JSON.parse(localStorage.getItem(SYSTEM_PREFS_KEY))||{})};}catch{return{theme:"light",brandColor:"#d52b1e",density:"comfortable",backupInterval:7,variflightDailyLimit:5,variflightUnlimited:false,variflightGlobalEnabled:false,maxConcurrentDevices:2,mailDeliveryConfigured:false,tourismCities:DEFAULT_TOURISM_CITIES,titles:[],stationDictionary:TravelFields.DEFAULT_DICTIONARY,cityAliases:[]};}}
  function applySystemAppearance(preferences=loadSystemPreferences()){document.documentElement.dataset.theme=preferences.theme||"light";document.documentElement.dataset.density=preferences.density||"comfortable";document.documentElement.style.setProperty("--system-brand",preferences.brandColor||"#d52b1e");if($("#variflightGlobalEnabled"))$("#variflightGlobalEnabled").checked=preferences.variflightGlobalEnabled===true;if($("#dictionaryStations"))$("#dictionaryStations").value=TravelFields.stringifyDictionary(preferences.stationDictionary||[]);if($("#dictionaryCityAliases"))$("#dictionaryCityAliases").value=(preferences.cityAliases||[]).map(item=>`${item.alias}|${item.city}`).join("\n");}
  function maybeAutoBackup(){const preferences=loadSystemPreferences();if(!preferences.backupInterval)return;const last=localStorage.getItem("lilly-meeting-last-auto-backup");if(last&&Date.now()-new Date(last).getTime()<preferences.backupInterval*86400000)return;const snapshot={version:1,createdAt:new Date().toISOString(),state,systemPreferences:preferences};localStorage.setItem("lilly-meeting-auto-backup",JSON.stringify(snapshot));localStorage.setItem("lilly-meeting-last-auto-backup",snapshot.createdAt);}
  async function saveVerificationGlobalSetting(enabled){
    if(!isSystemAdmin()){renderVerificationPage();return deny();}
    const preferences={...loadSystemPreferences(),variflightGlobalEnabled:enabled===true,savedAt:new Date().toISOString()};
    try{
      if(backend){const{error}=await backend.from("system_configuration").upsert({singleton:true,settings:preferences,updated_by:state.currentUserId,updated_at:new Date().toISOString()});if(error)throw error;}
      localStorage.setItem(SYSTEM_PREFS_KEY,JSON.stringify(preferences));
      addNotification("change",`${currentUser().name}${enabled?"开启":"关闭"}了飞常准全局查询`,{read:true,auditOnly:true});
      persistStateLocally();renderSystemSettings();renderVerificationPage();toast(`飞常准全局查询已${enabled?"开启":"关闭"}`);
    }catch(error){renderVerificationPage();toast(`全局查询设置保存失败：${error.message}`,"error");}
  }
  async function saveSystemPreferences(){if(!isSystemAdmin())return deny();const split=value=>[...new Set(String(value||"").split(/[、,，\n]+/).map(item=>item.trim()).filter(Boolean))];let stationDictionary,cityAliases;try{stationDictionary=TravelFields.parseDictionary($("#dictionaryStations").value);cityAliases=String($("#dictionaryCityAliases")?.value||"").split(/\r?\n/).filter(line=>line.trim()).map((line,index)=>{const[alias,city]=line.split("|").map(TravelFields.clean);if(!alias||!city)throw new Error(`城市别名第 ${index+1} 行格式错误`);return{alias,city:TravelFields.normalizeCity(city)};});}catch(error){return toast(error.message,"error");}const variflightDailyLimit=Math.max(1,Math.min(10000,Math.trunc(Number($("#variflightDailyLimit").value)||5)));const preferences={...loadSystemPreferences(),theme:$("#systemTheme").value,brandColor:$("#systemBrandColor").value,density:$("#tableDensity").value,backupInterval:Number($("#backupInterval").value)||0,variflightDailyLimit,variflightUnlimited:$("#variflightUnlimited").checked,variflightGlobalEnabled:$("#variflightGlobalEnabled").checked,maxConcurrentDevices:Math.max(1,Math.min(20,Math.trunc(Number($("#maxConcurrentDevices").value)||2))),tourismCities:split($("#dictionaryTourismCities").value),titles:split($("#dictionaryTitles").value),stationDictionary,cityAliases,savedAt:new Date().toISOString()};if(backend){const{error}=await backend.from("system_configuration").upsert({singleton:true,settings:preferences,updated_by:state.currentUserId,updated_at:new Date().toISOString()});if(error)return toast(`系统设置云端保存失败：${error.message}`,"error");const dictionaryRows=TravelFields.dictionary(stationDictionary).map(item=>({city:item.city,type:item.type,name:item.name,short_name:item.shortName||TravelFields.displayStation(item.name,item.type)}));const dictionarySave=await backend.rpc("replace_station_dictionary",{p_items:dictionaryRows});if(dictionarySave.error)return toast("场站字典云端保存失败："+dictionarySave.error.message,"error");const aliasSave=await backend.rpc("replace_city_aliases",{p_items:cityAliases});if(aliasSave.error)return toast("城市别名云端保存失败："+aliasSave.error.message,"error");}localStorage.setItem(SYSTEM_PREFS_KEY,JSON.stringify(preferences));applySystemAppearance(preferences);bindJourneyForm($("#registrationForm"));addNotification("change",`${currentUser().name}更新了系统设置与业务字典`,{read:true,auditOnly:true});persistStateLocally();renderSystemSettings();renderVerificationPage();toast("系统设置已保存");}
  function renderSystemSettings(){if(!$("#globalLogList"))return;const preferences=loadSystemPreferences();applySystemAppearance(preferences);if(!isSystemAdmin())return;$("#systemTheme").value=preferences.theme;$("#systemBrandColor").value=preferences.brandColor;$("#tableDensity").value=preferences.density;$("#backupInterval").value=String(preferences.backupInterval);$("#variflightDailyLimit").value=String(preferences.variflightDailyLimit||5);$("#variflightUnlimited").checked=preferences.variflightUnlimited===true;$("#variflightDailyLimit").disabled=preferences.variflightUnlimited===true;$("#variflightQuotaStatus").textContent=preferences.variflightUnlimited===true?"无限制（可能收费）":`每日 ${preferences.variflightDailyLimit||5} 次`;$("#variflightQuotaStatus").className=`status ${preferences.variflightUnlimited===true?"status-alert":"status-pending"}`;$("#maxConcurrentDevices").value=String(preferences.maxConcurrentDevices||2);$("#dictionaryTourismCities").value=(preferences.tourismCities||DEFAULT_TOURISM_CITIES).join("、");$("#dictionaryTitles").value=(preferences.titles||[]).join("、");const lastBackup=localStorage.getItem("lilly-meeting-last-backup");$("#backupStatus").textContent=`自动备份：${preferences.backupInterval?`每${preferences.backupInterval}天一次（浏览器本地快照）`:"已关闭"}；最近备份：${lastBackup?new Date(lastBackup).toLocaleString("zh-CN",{hour12:false}):"暂无"}`;const query=$("#globalLogSearch").value.trim().toLowerCase();const logs=(state.notifications||[]).filter(item=>!query||[item.text,item.actorName,item.attendeeName,...(item.changes||[]).flatMap(change=>[change.label,change.before,change.after])].join(" ").toLowerCase().includes(query));$("#globalLogList").innerHTML=logs.slice(0,100).map(item=>`<button type="button" data-notification-detail="${item.id}" class="global-log-row"><span>${escapeHtml(item.actorName||"系统")}</span><strong>${escapeHtml(item.text)}</strong><small>${new Date(item.time).toLocaleString("zh-CN",{hour12:false})}</small></button>`).join("")||`<div class="empty-state">没有匹配的操作日志</div>`;$$('[data-notification-detail]',$("#globalLogList")).forEach(button=>button.onclick=()=>openNotificationDetail(button.dataset.notificationDetail));const people=staffDirectory.length?staffDirectory:state.users;$("#systemPermissionOverview").innerHTML=people.map(person=>`<div class="permission-row"><span class="avatar tiny">${escapeHtml((person.display_name||person.name||"管").slice(0,1))}</span><div><strong>${escapeHtml(person.display_name||person.name||"未命名账号")}</strong><small>${escapeHtml(person.email||person.label||person.system_role||person.role||"会务负责人")}</small></div><b>${person.system_role==="super_admin"||person.id===state.currentUserId&&isSystemAdmin()?(person.project_enabled?"超级管理员 / 会务负责人":"超级管理员"):person.system_role==="readonly"?"只读查看":"会务负责人"}</b></div>`).join("");}

  async function createAdminAccessLink(){if(!backend||!isSystemAdmin())return deny();const button=$("#createAdminAccessLink");button.disabled=true;try{const minutes=Math.max(5,Math.min(1440,Math.trunc(Number($("#adminAccessLinkMinutes").value)||60)));const email=$("#adminAccessLinkEmail").value.trim().toLowerCase()||null;const{data,error}=await backend.rpc("create_admin_access_link",{p_minutes:minutes,p_target_email:email});if(error)throw error;const row=Array.isArray(data)?data[0]:data;const url=new URL(location.origin+location.pathname);url.searchParams.set("admin_access",row.token);url.hash="dashboard";await navigator.clipboard.writeText(url.toString());$("#adminAccessLinkResult").textContent=`临时链接已复制，有效至 ${new Date(row.expires_at).toLocaleString("zh-CN",{hour12:false})}。`;toast("临时登录链接已复制");}catch(error){$("#adminAccessLinkResult").textContent=`生成失败：${error.message}`;toast("临时链接生成失败","error");}finally{button.disabled=false;}}
  function downloadSystemBackup(){if(!isSystemAdmin())return deny();const snapshot={version:1,createdAt:new Date().toISOString(),state,systemPreferences:loadSystemPreferences()};const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download=`lilly-meeting-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);localStorage.setItem("lilly-meeting-last-backup",snapshot.createdAt);addNotification("backup",`${currentUser().name}下载了系统完整数据快照`,{read:true,auditOnly:true});persistStateLocally();renderSystemSettings();toast("数据快照已下载");}
  async function restoreSystemBackup(file){if(!isSystemAdmin()||!file)return deny();try{const snapshot=JSON.parse(await file.text());if(!snapshot?.state?.attendees||!snapshot?.state?.projects)throw new Error("备份文件结构不正确");if(!confirm("高风险操作：恢复将覆盖当前浏览器中的会议、名单和设置。是否继续？"))return;const phrase=prompt("二次确认：请输入“确认恢复”后执行");if(phrase!=="确认恢复")return toast("已取消数据恢复","error");state=snapshot.state;persistStateLocally();if(snapshot.systemPreferences)localStorage.setItem(SYSTEM_PREFS_KEY,JSON.stringify(snapshot.systemPreferences));populateUsers();populateProjects();renderAll();toast("备份已恢复；云端项目数据未被覆盖");}catch(error){toast(`恢复失败：${error.message}`,"error");}finally{$("#restoreBackupFile").value="";}}

  async function exportExcel() {
    if(isReadOnlyStaff()||!isSystemAdmin()&&!['ops','client','sales'].includes(currentUser().role))return toast("只读账号没有敏感数据导出权限","error");
    const attendeeList=visibleAttendees();
    const exportColumns=columnsWithJourneyFields(meetingTemplateColumns());
    const supplementalColumns=rosterSupplementalColumns(attendeeList,exportColumns);
    const supplementalHeaders=supplementalColumns.flatMap(column=>column.key==="_journeySegments"?["新增多段行程明细","新增多段行程核验"]:[column.header]);
    const registrantHeaders=["报名人姓名","报名人大区","报名人员工编号","报名人唯一标识","报名来源","报名提交时间"];
    const headers=[...exportColumns.map(column=>column.header),...supplementalHeaders,...registrantHeaders,"报名状态","隐私沟通函状态","去程审批状态","返程审批状态","出票状态","去程计划时刻核验","返程计划时刻核验"];
    const progressLabels={pending:"未完成",electronic:"已完成（隐私沟通函电子版）",paper:"已完成（隐私沟通函纸质版）",processing:"出票中",ticketed:"已出票",changed:"改签",refunded:"已退票"};
    const segmentLabels={normal:"无需审批",pending:"待审批",approved:"已审批",rejected:"已退回"};
    const rows=attendeeList.map((a,i)=>[...exportColumns.map(column=>{
      if(column.key==="sequence") return i+1;
      if(column.key==="contactName") return a.contactName||"";
      if(column.key==="contactMobile") return a.contactMobile||"";
      if(/TransportType$/.test(column.key))return TravelFields.TYPES[a[column.key]]||a[column.key]||"";
      if(/Station$/.test(column.key))return TravelFields.officialStation(a[column.key],a[column.key.replace("Station","TransportType")],stationDictionary())||"";
      return column.custom ? a.customFields?.[column.key]||"" : a[column.key]||"";
    }),...supplementalColumns.flatMap(column=>column.key==="_journeySegments"?[JSON.stringify(a.customFields?._journeySegments||[]),(a.customFields?._journeySegments||[]).map(item=>{const segment=`${item.direction==="return"?"return":"outbound"}:${item.id}`;return`${item.number||"未填写"}：${verificationExport(a.customFields?._travelVerification?.[segment],a,segment)}`;}).join("；")]:[column.value(a)]),a.registrantName||"",a.registrantRegion||"",a.registrantEmployeeNo||"",a.registrantId||"",a.registrantId?"报名端提交":"后台导入/新增",a.createdAt?new Date(a.createdAt).toLocaleString("zh-CN",{hour12:false}):"",a.businessStatus==="cancelled"?"已取消报名":"有效报名",progressLabels[a.privacyLetterStatus||"pending"],segmentLabels[segmentApproval(a,"outbound")],segmentLabels[segmentApproval(a,"return")],progressLabels[a.ticketStatus||"pending"],verificationExport(a.customFields?._travelVerification?.outbound,a,"outbound"),verificationExport(a.customFields?._travelVerification?.return,a,"return")]);
    if (window.XLSX) { const ws = XLSX.utils.aoa_to_sheet([headers,...rows]); ws["!cols"] = headers.map((_,i) => ({ wch: i === 0 ? 7 : 18 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"报名表"); try{await writeStyledWorkbook(wb,`${state.settings.slug||"项目"}-报名表-${new Date().toISOString().slice(0,10)}.xlsx`);toast("Excel 已按当前项目模板和统一格式导出");}catch(error){toast(`Excel 导出失败：${error.message}`,"error");} }
    else { const csv = [headers,...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv"})); link.download = "HEMA-SEM-报名表.csv"; link.click(); toast("已导出兼容 Excel 的 CSV 文件"); }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
