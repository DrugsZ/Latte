import type { IDisposable } from '@latte-js/bean'

class FunctionDisposable implements IDisposable {
	private _isDisposed: boolean;
	private readonly _fn: () => void;

	constructor(fn: () => void) {
		this._isDisposed = false;
		this._fn = fn;
	}

	dispose() {
		if (this._isDisposed) {
			return;
		}
		if (!this._fn) {
			throw new Error(`Unbound disposable context: Need to use an arrow function to preserve the value of this`);
		}
		this._isDisposed = true;
		this._fn();
	}
}


export function toDisposable(fn: () => void): IDisposable {
	return new FunctionDisposable(fn);
}