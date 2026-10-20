import { SetupPanel } from '../components/setup-panel';
import Workbench from '../components/workbench';
import { getSystemStatus } from '@leeos/core';
import { StatusCard } from '@leeos/ui';
export default function Home() {
  const state = getSystemStatus();
  return <main><header><span className="badge">LEE / OS</span><span>STRUCTURE 18 · LOCAL V1</span></header>
    <div className="intro"><p className="eyebrow">YOUR AUTOMATION WORKSHOP</p><h1>From request<br />to reviewed work.</h1>
    <p>Welcome, Lee. Use your Hub to turn a request into reviewed, controlled work. We’ll build the system one structure at a time.</p></div>
    <div className="grid"><StatusCard title="Local foundation"><p>Hub and core API code are included. Check local setup for live readiness.</p><small>Version {state.version}</small></StatusCard>
    <StatusCard title="$0 by design"><p>Local operation. No cloud accounts or paid API keys required.</p><small>Paid execution disabled</small></StatusCard>
    <StatusCard title="A clean beginning"><p>Jobs require your explicit approval to run.</p><small>Database readiness: /api/ready</small></StatusCard></div>
    <SetupPanel/>
    <Workbench/>
    <section className="roadmap"><h2>Connections for later</h2><div className="tags">{state.integrations.map(item => <span key={item.id}>{item.id} <small>planned</small></span>)}</div></section>
    <footer><span>Built to grow with you.</span><a href="/api/health">View system health →</a></footer></main>;
}
