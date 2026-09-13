export type Player={id:string;name:string;rank:number;points:number;change:number;avatar?:string};
export type Game={id:string;name:string;code:string;status:'waiting'|'voting'|'results'|'finished';round:number;totalRounds:number;maxPlayers:number;votesPerPlayer:number;durationSeconds:number;passwordProtected:true};
