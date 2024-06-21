





type Callback<T> = (() => any) | ((arg: T) => any);
//type Cleanup = () =>
//type Drop = () => void;

export default class Signal<T = void> extends Set<Callback<T>> {
	
	public static group(...callbacks: Array<() => void>): () => void {
		return () => {
			for (const callback of callbacks)
				callback();
		}
	}
	
	public listen(callback: Callback<T>): Callback<T> {
		this.add(callback);
		return callback;
	}
	public drop(callback: Callback<T>): void {
		this.delete(callback);
	}
	public dropAll(): void {
		this.clear();
	}
	
	public subscribe(callback: Callback<T>): () => void {
		this.listen(callback);
		return () => this.drop(callback);
	}
	
	/*public subscribe(callback: Callback<T>, chain?: () => void): () => void {
		
		this.listen(callback);
		
		return () => {
			chain?.();
			this.drop(callback);
		}
		
	}*/
	
	public emit(arg: T): void {
		
		for (const callback of this)
			callback(arg);
		
	}
	
}



