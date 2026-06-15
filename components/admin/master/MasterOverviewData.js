"use client";
import { readJson } from "@/components/admin/adminClientApi";
import { useEffect, useState } from "react";
export default function MasterOverviewData(){const [count,setCount]=useState(null);useEffect(()=>{let active=true;readJson("/api/admin/approval-masters").then((data)=>{if(active)setCount((data?.masters||[]).length);}).catch(()=>{if(active)setCount(0);});return()=>{active=false;};},[]);return <div className="admin-card">Total master: {count===null?"Loading...":count}</div>;}
