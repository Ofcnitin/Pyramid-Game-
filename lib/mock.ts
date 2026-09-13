import {Game,Player} from './types';
export const players:Player[]=[
{id:'p1',name:'Aarav',rank:1,points:2430,change:2},{id:'p2',name:'Saanvi',rank:2,points:2210,change:0},{id:'p3',name:'Vihaan',rank:3,points:2105,change:1},{id:'p4',name:'Meera',rank:4,points:1980,change:-2},{id:'p5',name:'Kabir',rank:5,points:1845,change:5},{id:'p6',name:'Isha',rank:6,points:1770,change:0},{id:'p7',name:'Rohan',rank:7,points:1620,change:3},{id:'p8',name:'Tanya',rank:8,points:1590,change:-1},{id:'p9',name:'Arjun',rank:9,points:1530,change:2},{id:'p10',name:'Naina',rank:10,points:1490,change:-1}];
export const game:Game={id:'g1',name:'Friday Night Pyramid',code:'PYR-8K4M2',status:'voting',round:3,totalRounds:6,maxPlayers:16,votesPerPlayer:3,durationSeconds:756};
