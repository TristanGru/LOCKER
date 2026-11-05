import { useCallback, useState } from 'react';
import { AssistantPanel } from './AssistantPanel';
import { OverviewChat } from './OverviewChat';

export function OverviewAssistantPanel({filter,domain}:{filter:string;domain:string}) {
  const [open,setOpen]=useState(false);
  const close=useCallback(()=>setOpen(false),[]);
  return <AssistantPanel open={open} onOpen={()=>setOpen(true)} onClose={close}><OverviewChat filter={filter} domain={domain}/></AssistantPanel>;
}
