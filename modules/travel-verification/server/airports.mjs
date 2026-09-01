// Airport identity only. This catalog never assigns a terminal or proves a dated flight route.
export const airports = [
 ['SHA','上海虹桥机场','上海虹桥'],['PVG','上海浦东机场','上海浦东'],
 ['PEK','北京首都机场','北京首都'],['PKX','北京大兴机场','北京大兴'],
 ['TFU','成都天府机场','成都天府'],['CTU','成都双流机场','成都双流'],
 ['KHN','南昌昌北机场','南昌昌北'],['DLC','大连周水子机场','大连周水子'],
 ['HGH','杭州萧山机场','杭州萧山'],['WNZ','温州龙湾机场','温州龙湾'],
 ['CSX','长沙黄花机场','长沙黄花'],['CAN','广州白云机场','广州白云'],
 ['FOC','福州长乐机场','福州长乐'],['SZX','深圳宝安机场','深圳宝安'],
 ['SWA','揭阳潮汕机场','揭阳潮汕'],['WEF','潍坊南苑机场','潍坊南苑'],
 ['NKG','南京禄口机场','南京禄口'],['YNT','烟台蓬莱机场','烟台蓬莱'],
 ['NTG','南通兴东机场','南通兴东'],['CKG','重庆江北机场','重庆江北'],
 ['XIY','西安咸阳机场','西安咸阳'],['CGO','郑州新郑机场','郑州新郑'],
 ['SJW','石家庄正定机场','石家庄正定'],['TYN','太原武宿机场','太原武宿'],
 ['TSN','天津滨海机场','天津滨海'],
 ['BAV','包头东河机场','包头东河'],['HRB','哈尔滨太平机场','哈尔滨太平'],
 ['CGQ','长春龙嘉机场','长春龙嘉'],['INC','银川河东机场','银川河东'],
 ['XMN','厦门高崎机场','厦门高崎'],['TAO','青岛胶东机场','青岛胶东'],
 ['WUH','武汉天河机场','武汉天河'],['KMG','昆明长水机场','昆明长水']
].map(([code,name,alias])=>({code,name,alias}));
const clean=v=>String(v??'').normalize('NFKC').trim();
export function terminal(v){
 const s=clean(v).toUpperCase().replace(/\s/g,'').replace(/航站楼$/,'');
 if(!s)return '';
 if(/^(?:T|TERMINAL)?\d{1,2}[A-Z]?$/.test(s))return 'T'+s.replace(/^(?:TERMINAL|T)/,'');
 return s; // Preserve named terminals, without inventing a numbered terminal.
}
export function rawTerminal(v){return terminal(clean(v).match(/(?:T\s*\d{1,2}[A-Za-z]?|\d{1,2}号?航站楼)\s*$/i)?.[0]?.replace('号',''));}
export function airport(v){
 const s=clean(v).toUpperCase().replace(/(?:[ ·]*T\s*\d{1,2}[A-Z]?(?:航站楼)?)$/,'').trim();
 return airports.find(a=>[a.code,a.name,a.alias,a.name.replace('机场','国际机场')].some(n=>n.toUpperCase()===s));
}
export function location(t,side){
 const raw=t[side]||'';if(t.type!=='flight')return raw;
 const a=airport(t[side+'Code'])||airport(raw),name=a?.name||t[side+'AirportName']||raw;
 const term=t[side+'Terminal']!==undefined?terminal(t[side+'Terminal']):rawTerminal(raw);
 const base=rawTerminal(name)?name.replace(/\s*T\s*\d{1,2}[A-Za-z]?(?:航站楼)?\s*$/i,''):name;
 return `${base||'机场待确认'} · ${term?term+'航站楼':'航站楼待确认'}`;
}
