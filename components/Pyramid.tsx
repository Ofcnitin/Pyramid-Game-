'use client';
import {Player} from '@/lib/types';
const tiers=(p:Player[])=>[p.slice(0,1),p.slice(1,3),p.slice(3,6),p.slice(6,10)];
export default function Pyramid({players}:{players:Player[]}){return <div className="pyramid-wrap"><div className="pyramid"><div className="levels">{tiers(players).map((tier,i)=><div className={'level '+(i===0?'top':'')} key={i}>{tier.map(x=><div className="person" key={x.id} title={`${x.name} • #${x.rank}`}>{x.rank}</div>)}</div>)}</div></div><div className="tier-labels">{tiers(players).map((t,i)=><div className="tier-label" key={i}><b>Tier {i+1}</b>{t.length} {t.length===1?'player':'players'}</div>)}</div></div>}
