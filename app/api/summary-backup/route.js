import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic";

export async function GET(){

  const { data,error } = await supabase
    .rpc("tracelog_backup_summary")

  console.log("RPC result:", data, error)

  if(error){

    return Response.json(
      { error:error.message },
      { status:500 }
    )

  }

  return Response.json(data)

}
