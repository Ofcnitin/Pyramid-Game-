export function Logo({dark=false}:{dark?:boolean}){return <img src="/logo.svg" alt="Pyramid Game" className="logo" style={dark?{filter:'invert(1)'}:undefined}/>}
