"use client";
import AdminSubtabs from "@/components/admin/AdminSubtabs";
import RoleSecurityOverview from "@/components/admin/RoleSecurityOverview";
import RoleManagementTab from "@/components/admin/tabs/RoleManagementTab";
import { useState } from "react";
export default function RoleManagementLazyTab(){const[panel,setPanel]=useState("control");return <><AdminSubtabs value={panel} onChange={setPanel} ariaLabel="Role navigation" items={[{value:"control",label:"Role Control",panelId:"role-control-panel"},{value:"security",label:"Security Overview",panelId:"role-security-panel"}]}/>{panel==="control"&&<div id="role-control-panel" role="tabpanel"><RoleManagementTab/></div>}{panel==="security"&&<RoleSecurityOverview/>}</>;}
