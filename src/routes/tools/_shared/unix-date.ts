export function epochSecondsToMilliseconds(seconds: number): number {
	const milliseconds = seconds * 1000;
	const rounded = Math.round(milliseconds);
	// 正確にミリ秒へ戻せる秒の値では、乗算時の丸め誤差を取り除く。
	return rounded / 1000 === seconds ? rounded : milliseconds;
}
