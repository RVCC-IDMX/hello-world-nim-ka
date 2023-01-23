/**
 * For my JS class at RVCC
 * Thought I'd give you a bit of a laugh :)
 * Started writing this a few days ago
 */

/**
 * [[ VM specification ]]
 *
 * CursedVM™ is a 32-bit big-endian machine. It is incredibly ridiculously designed, mainly due to extreme sleep deprivation.
 * There are 32 registers and a stack, as well as a global environment.
 * External JS objects can be loaded through the global environment.
 * There is also a secondary "immediate re-use stack" (IRS), and a call stack which is not exposed to the VM.
 * CursedVM™ objects can have type null, int, float, ptr (pointer), or ext (external object).
 * Instructions are a fixed 4 bytes long.
 * Instructions are sorted into 16 instruction classes. The first 4 bits of each instruction signify the instruction class.
 *
 * The instruction classes are as follows:
 *  0. nop
 *    - nop
 *      Encoding: 0000S??? ???????? AAAAAAAA AAAAAAAA
 *        Does nothing. If S is set, A is sign-extended and pushed onto the IRS.
 *  1. exit
 *    - exit.i
 *      Encoding: 0001???0 ???????? AAAAAAAA AAAAAAAA
 *        Exits with signed exit value A.
 *    - exit.r
 *      Encoding: 0001???1 ???RRRRR ???????? ????????
 *        Exits with the value in register R.
 *  2. push
 *    - push.i
 *      Encoding: 0010???0 ???????? AAAAAAAA AAAAAAAA
 *        Sign-extends A, creates an integer object from it, and pushes the object onto the stack.
 *    - push.r
 *      Encoding: 0010S??1 ???RRRRR AAAAAAAA AAAAAAAA
 *        Pushes the object in register R onto the stack. If S is set, A is sign-extended and pushed onto the IRS.
 *  3. pop
 *    - pop
 *      Encoding: 0011S??0 ???RRRRR AAAAAAAA AAAAAAAA
 *        Pops an object from the stack into register R. If S is set, A is sign-extended and pushed onto the IRS.
 *    - ipop
 *      Encoding: 0011S??1 ???RRRRR AAAAAAAA AAAAAAAA
 *        Pops an object from the IRS into register R. If S is set, A is sign-extended and pushed onto the IRS after.
 *  4. ret
 *    - ret
 *      Encoding: 0100S??? ???????? AAAAAAAA AAAAAAAA
 *        Returns from a subroutine. If S is set, A is sign-extended and pushed onto the IRS.
 *  5. get
 *    - get
 *      Encoding: 0101???0 ???YYYYY ???XXXXX ????????
 *        Gets a variable from the environment. X should be a register holding a pointer to a string; the environment variable with that key will be loaded as an int into register Y, or null if no variable exists.
 *    - load
 *      Encoding: 0101???1 ???YYYYY ???XXXXX ????????
 *        Loads a variable from the environment. X should be a register holding a pointer to a string; the environment variable with that key will be loaded as an external object into register Y, or null if no variable exists.
 *        External objects are currently only useful for calling JS functions from the VM, which can be done using the call.r instruction.
 *  6. set
 *    - set
 *      Encoding: 0110???? ???YYYYY ???XXXXX ????????
 *        Sets an environment variable. X should be a register holding a pointer to a string. That key in the environment will be set to the value of register Y. Y must be an integer.
 *  7. b
 *    - b.i
 *      Encoding: 0111?000 0??????? AAAAAAAA AAAAAAAA
 *        Sign-extends A and branches that many instructions from the current instruction. b.i 1 does nothing, whereas b.i 0 is an infinite loop.
 *    - b.r
 *      Encoding: 0111S001 0??RRRRR AAAAAAAA AAAAAAAA
 *        Same as b.i, but branches according to the value of the register R. R must be an integer. If S is set, A is sign-extended and pushed onto the IRS.
 *    - b.abs.i
 *      Encoding: 0111?010 0??????? AAAAAAAA AAAAAAAA
 *        Same as b.i, but an absolute jump. Branches to the given offset in memory.
 *    - b.abs.r
 *      Encoding: 0111S011 0??RRRRR AAAAAAAA AAAAAAAA
 *        Same as b.abs.i, but jumps according to the value of the register R. R must be an integer or a pointer. If S is set, A is sign-extended and pushed onto the IRS.
 *    - call.i
 *      Encoding: 0111S110 0??????? AAAAAAAA AAAAAAAA
 *        Same as b.abs.i, but calls a subroutine.
 *    - call.r
 *      Encoding: 0111S111 0??RRRRR AAAAAAAA AAAAAAAA
 *        Same as b.abs.r, but calls a subroutine. If R is an external object instead of an integer or pointer, it will call the external JS function associated with it.
 *    - bc.i
 *      Encoding: 0111?000 1??????? AAAAAAAA AAAAAAAA
 *        Same as b.i, but only branches if comparison result register is non-zero.
 *    - bc.r
 *      Encoding: 0111S001 1??RRRRR AAAAAAAA AAAAAAAA
 *        Same as b.r, but only branches if comparison result register is non-zero.
 *    - bc.abs.i
 *      Encoding: 0111?010 1??????? AAAAAAAA AAAAAAAA
 *        Same as b.abs.i, but only branches if comparison result register is non-zero.
 *    - bc.abs.r
 *      Encoding: 0111S011 1??RRRRR AAAAAAAA AAAAAAAA
 *        Same as b.abs.r, but only branches if comparison result register is non-zero.
 *    - callc.i
 *      Encoding: 0111S110 1??????? AAAAAAAA AAAAAAAA
 *        Same as call.i, but only calls if comparison result register is non-zero.
 *    - callc.r
 *      Encoding: 0111S111 1??RRRRR AAAAAAAA AAAAAAAA
 *        Same as call.r, but only calls if comparison result register is non-zero.
 *  8. cmp
 *    - c.METHOD.i
 *      Encoding: 1000SCCC ??0XXXXX AAAAAAAA AAAAAAAA
 *        Compares the values of register X and the sign-extended value A, and writes the result to the designated comparison result register.
 *        The comparison method is based on the value C:
 *          - 000: c.cmp.i;  returns -1 if X < A, 0 if X == A, 1 if X > A
 *          - 001: c.eq.i;   returns 1 if X == A, 0 otherwise
 *          - 010: c.lt.i;   returns 1 if X < A, 0 otherwise
 *          - 011: c.gt.i;   returns 1 if X > A, 0 otherwise
 *          - 100: c.not.i;  returns 1 if X == 0, 0 otherwise. If S is set, A is sign-extended and pushed onto the IRS.
 *          - 101: c.neq.i;  returns 1 is X != A, 0 otherwise
 *          - 110: c.gte.i;  returns 1 if X >= A, 0 otherwise
 *          - 111: c.lte.i;  returns 1 if X <= A, 0 otherwise
 *    - c.METHOD.r
 *      Encoding: 1000GCCC ??1XXXXX ???YYYYY ???ZZZZZ
 *        The idea is the same as c.METHOD.i, but comparing with the value of register Z instead of an immediate.
 *        If G is set, the result of the comparison is written to register Y instead of the comparison result register.
 *        Comparison methods:
 *          - 000: c.cmp.r;  returns -1 if X < Z, 0 if X == Z, 1 if X > Z
 *          - 001: c.eq.r;   returns 1 if X == Z, 0 otherwise
 *          - 010: c.lt.r;   returns 1 if X < Z, 0 otherwise
 *          - 011: reserved
 *          - 100: c.same.r; returns 1 if X and Z contain the same object, 0 otherwise
 *          - 101: c.neq.r;  returns 1 is X != Z, 0 otherwise
 *          - 110: c.gte.r;  returns 1 if X >= Z, 0 otherwise
 *          - 111: reserved
 *  9. cvt
 *    - cvt.TYPE.i
 *      Encoding: 1001STTT ??0YYYYY AAAAAAAA AAAAAAAA
 *        Sign-extend A, convert it to an object with type T, and store the object in register Y.
 *        Type codes:
 *          - 000: null; sets Y to a new null object. If S is set, A is sign-extended and pushed onto the IRS.
 *          - 001: int
 *          - 010: float
 *          - 011: ptr
 *          - 100: ext (error)
 *          - 101: reserved (error)
 *          - 110: reserved (error)
 *          - 111: reserved (error)
 *    - cvt.TYPE.r
 *      Encoding: 10010TTT ??1YYYYY ???????? ???XXXXX
 *        Convert the value in register X to an object with type T, and store it in register Y.
 *        Type codes:
 *          - 000: null; sets Y to a new null object.
 *          - 001: int
 *          - 010: float (error if X is ptr)
 *          - 011: ptr (error if X is float)
 *          - 100: ext (error)
 *          - 101: reserved (error)
 *          - 110: reserved (error)
 *          - 111: See deref instruction
 *    - deref
 *      Encoding: 10010111 ??1YYYYY ???????? ???XXXXX
 *        Dereference the pointer in register X and store the result in register Y.
 *    - repr.FROM.TO
 *      Encoding: 10011TTT ??1YYYYY ???00FFF ???XXXXX
 *        Reinterpret the value in register X as type F, and convert it to type T and store in register Y.
 *        Reinterpretation of X is not possible unless X is of type int, float, or ptr, and F is 001 (int), 010 (float), or 011 (ptr).
 *        Type codes:
 *          - 000: null; sets Y to a new null object.
 *          - 001: int
 *          - 010: float (error if F is ptr)
 *          - 011: ptr (error if F is float)
 *          - 100: ext (error)
 *          - 101: reserved (error)
 *          - 110: reserved (error)
 *          - 111: reserved (error)
 *  10. reserved
 *  11. reserved
 *  12. reserved
 *  13. reserved
 *  14. reserved
 *  15. reserved
 *
 * You may notice many basic things are missing, such as adding numbers, or writing to memory. This is because I'm lazy.
 * It *might* actually be Turing-complete in its current state, since the control flow is quite capable. I'm not sure.
 *
 * Special registers:
 *  - Register 0 contains an int object with value 0. It is read-only.
 *  - Register 1 is the comparison result register.
 *  - Register 2 is the program counter. It is a read-only pointer.
 *  - Register 27 is the IRS pointer. The IRS is segregated from main memory.
 *  - Register 28 is the IRS pop register. It is read-only, and has special behavior; when read from, it pops an object from the IRS and returns it.
 *  - Register 29 is the stack pointer. The stack is segregated from main memory.
 *  - Register 30 is the stack push register. When an object is written to it, it pushes that object onto the stack.
 *  - Register 31 is the stack pop register. It is read-only, and has special behavior; when read from, it pops an object from the stack and returns it.
 */

const DEBUG = false

function debug(...args) {
	if (DEBUG) {
		console.log(...args)
	}
}

class VMError extends Error {
	constructor(message, ...params) {
		super(message, ...params)
		
		this.name = this.constructor.name
	}
}

class VMObject {
	static TYPE_NULL  = 0b000
	static TYPE_INT   = 0b001
	static TYPE_FLOAT = 0b010
	static TYPE_PTR   = 0b011
	static TYPE_EXT   = 0b100
	
	static TYPE_NAME_TABLE = {
		[VMObject.TYPE_NULL]:  "null",
		[VMObject.TYPE_INT]:   "int",
		[VMObject.TYPE_FLOAT]: "float",
		[VMObject.TYPE_PTR]:   "ptr",
		[VMObject.TYPE_EXT]:   "ext"
	}

	static getTypeName(type) {
		let name = VMObject.TYPE_NAME_TABLE[type]

		if (name) {
			return name
		} else {
			return type.toString(2).padStart(3, "0")
		}
	}
	
	static isTypeNumeric(type) {
		return type == VMObject.TYPE_INT || type == VMObject.TYPE_FLOAT
	}
	
	static isTypeNumericOrPtr(type) {
		return type == VMObject.TYPE_INT || type == VMObject.TYPE_FLOAT || type == VMObject.TYPE_PTR
	}

	static CONVERT_TABLE = {
		[VMObject.TYPE_NULL]:  "convertNull",
		[VMObject.TYPE_INT]:   "convertInt",
		[VMObject.TYPE_FLOAT]: "convertFloat",
		[VMObject.TYPE_PTR]:   "convertPtr",
		[VMObject.TYPE_EXT]:   "convertExt"
	}

	static REINTERPRET_TABLE = {
		[VMObject.TYPE_NULL]:  "reinterpretNull",
		[VMObject.TYPE_INT]:   "reinterpretInt",
		[VMObject.TYPE_FLOAT]: "reinterpretFloat",
		[VMObject.TYPE_PTR]:   "reinterpretPtr",
		[VMObject.TYPE_EXT]:   "reinterpretExt"
	}

	type = VMObject.TYPE_NULL
	value = null

	constructor(vm) {
		this.vm = vm
	}

	getPrimitive() {
		return this.value
	}

	setPrimitive(value) {
		this.value = value
	}

	convert(type) {
		let converter = VMObject.CONVERT_TABLE[type]

		if (converter) {
			return this[converter]()
		} else {
			throw new VMError(`Tried to convert object to unrecognized type ${VMObject.getTypeName(type)}`)
		}
	}

	convertNull() {
		return this.vm.create(VMNull)
	}

	convertInt() {
		throw new VMError(`Tried to convert object of type ${VMObject.getTypeName(this.type)} to int`)
	}

	convertFloat() {
		throw new VMError(`Tried to convert object of type ${VMObject.getTypeName(this.type)} to float`)
	}

	convertPtr() {
		throw new VMError(`Tried to convert object of type ${VMObject.getTypeName(this.type)} to ptr`)
	}

	convertExt() {
		throw new VMError(`Tried to convert object of type ${VMObject.getTypeName(this.type)} to ext`)
	}

	reinterpret(type) {
		let reinterpreter = VMObject.REINTERPRET_TABLE[type]

		if (reinterpreter) {
			return this[reinterpreter]()
		} else {
			throw new VMError(`Tried to reinterpret object as unrecognized type ${VMObject.getTypeName(type)}`)
		}
	}

	reinterpretNull() {
		return this.vm.create(VMNull)
	}

	reinterpretInt() {
		throw new VMError(`Tried to reinterpret object of type ${VMObject.getTypeName(this.type)} as int`)
	}

	reinterpretFloat() {
		throw new VMError(`Tried to reinterpret object of type ${VMObject.getTypeName(this.type)} as float`)
	}

	reinterpretPtr() {
		throw new VMError(`Tried to reinterpret object of type ${VMObject.getTypeName(this.type)} as ptr`)
	}

	reinterpretExt() {
		throw new VMError(`Tried to reinterpret object of type ${VMObject.getTypeName(this.type)} as ext`)
	}
}

class VMNull extends VMObject {
	convertInt() {
		return this.vm.create(VMInt, 0)
	}

	convertFloat() {
		return this.vm.create(VMFloat, 0)
	}

	convertPtr() {
		return this.vm.create(VMPtr, this.vm.memory, 0)
	}

	reinterpretInt() {
		return this.vm.create(VMInt, 0)
	}

	reinterpretFloat() {
		return this.vm.create(VMFloat, 0)
	}

	reinterpretPtr() {
		return this.vm.create(VMPtr, this.vm.memory, 0)
	}
}

class VMInt extends VMObject {
	type = VMObject.TYPE_INT
	data = new DataView(new ArrayBuffer(4))

	constructor(vm, value) {
		super(vm)

		this.setPrimitive(value)
	}

	getPrimitive() {
		return this.data.getInt32(0)
	}

	setPrimitive(value) {
		this.data.setInt32(0, value)
	}

	convertInt() {
		return this.vm.create(VMInt, this.getPrimitive())
	}

	convertFloat() {
		return this.vm.create(VMFloat, this.getPrimitive())
	}

	convertPtr() {
		return this.vm.create(VMPtr, this.vm.memory, this.getPrimitive())
	}

	reinterpretInt() {
		return this.vm.create(VMInt, this.getPrimitive())
	}

	reinterpretFloat() {
		return this.vm.create(VMFloat, this.data.getFloat32(0))
	}

	reinterpretPtr() {
		return this.vm.create(VMFloat, this.vm.memory, this.getPrimitive())
	}
}

class VMFloat extends VMObject {
	type = VMObject.TYPE_FLOAT
	data = new DataView(ArrayBuffer(4))

	constructor(vm, value) {
		super(vm)

		this.setPrimitive(value)
	}

	getPrimitive() {
		return this.data.getFloat32(0)
	}

	setPrimitive(value) {
		this.data.setFloat32(0, value)
	}

	convertInt() {
		return this.vm.create(VMInt, this.getPrimitive())
	}

	convertFloat() {
		return this.vm.create(VMFloat, this.getPrimitive())
	}

	reinterpretInt() {
		return this.vm.create(VMInt, this.data.getInt32(0))
	}

	reinterpretFloat() {
		return this.vm.create(VMFloat, this.getPrimitive())
	}
}

class VMPtr extends VMObject {
	type = VMObject.TYPE_PTR
	data = new DataView(new ArrayBuffer(4))

	constructor(vm, memory, value) {
		super(vm)

		this.memory = memory
		this.setPrimitive(value)
	}

	getPrimitive() {
		return this.data.getUint32(0)
	}

	setPrimitive(value) {
		this.data.setUint32(0, value)
	}

	convertInt() {
		return this.vm.create(VMInt, this.getPrimitive())
	}

	convertPtr() {
		return this.vm.create(VMPtr, this.memory, this.getPrimitive())
	}

	reinterpretInt() {
		return this.vm.create(VMInt, this.getPrimitive())
	}

	reinterpretPtr() {
		return this.vm.create(VMPtr, this.memory, this.getPrimitive())
	}

	read(offset) {
		return this.memory.read(this.getPrimitive() + offset)
	}

	write(offset, obj) {
		return this.memory.write(this.getPrimitive() + offset, obj)
	}
	
	readString(maxLength = Infinity) {
		if (!(this.memory instanceof VMIntMemory)) {
			throw new VMError(`Tried to read string from pointer to object memory`)
		}
		
		let data = []
		let view = new DataView(new ArrayBuffer(4))
		
		out: for (let i = 0; i < maxLength / 4; i++) {
			view.setUint32(0, this.read(i))
			
			for (let j = 0; j < 4; j++) {
				let val = view.getUint8(j)
				
				if (val == 0 || data.length >= maxLength) {
					break out
				} else {
					data.push(val)
				}
			}
		}
		
		return this.vm.decodeStringUtf8(Uint8Array.from(data), maxLength)
	}
}

class VMExt extends VMObject {
	type = VMObject.TYPE_EXT

	constructor(vm, value) {
		super(vm)
		
		this.value = value
	}
}

class VMRegisters {
	static NUM_REGISTERS = 32
	
	static REG_ZERO = 0
	static REG_COMP = 1
	static REG_PC = 2
	static REG_IRSP = 27
	static REG_IPOP = 28
	static REG_SP = 29
	static REG_PUSH = 30
	static REG_POP = 31
	
	static GETTER_TABLE = {
		[VMRegisters.REG_ZERO]: null,
		[VMRegisters.REG_COMP]: null,
		[VMRegisters.REG_PC]:   null,
		[VMRegisters.REG_IRSP]: null,
		[VMRegisters.REG_IPOP]: "getIpop",
		[VMRegisters.REG_SP]:   null,
		[VMRegisters.REG_PUSH]: null,
		[VMRegisters.REG_POP]:  "getPop"
	}
	
	static SETTER_TABLE = {
		[VMRegisters.REG_ZERO]: "setZero",
		[VMRegisters.REG_COMP]: null,
		[VMRegisters.REG_PC]:   "setPc",
		[VMRegisters.REG_IRSP]: "setIrsp",
		[VMRegisters.REG_IPOP]: "setIpop",
		[VMRegisters.REG_SP]:   "setSp",
		[VMRegisters.REG_PUSH]: "setPush",
		[VMRegisters.REG_POP]:  "setPop"
	}
	
	registers = Object.seal(new Array(VMRegisters.NUM_REGISTERS).fill(0))

	constructor(vm) {
		this.vm = vm

		this.reset()
	}
	
	reset() {
		this.registers.fill(this.vm.nullObject)
		
		this.registers[VMRegisters.REG_ZERO] = this.vm.create(VMInt, 0)
		this.registers[VMRegisters.REG_PC] = this.vm.create(VMPtr, this.vm.memory, 0)
		this.registers[VMRegisters.REG_IRSP] = this.vm.create(VMPtr, this.vm.irs, 0)
		this.registers[VMRegisters.REG_SP] = this.vm.create(VMPtr, this.vm.stack, 0)
	}
	
	get(num) {
		if (num < 0 || num >= VMRegisters.NUM_REGISTERS) {
			throw new VMError(`Tried to read invalid register $${num}`)
		}

		let getter = VMRegisters.GETTER_TABLE[num]
		
		if (getter) {
			return this[getter]()
		} else {
			return this.registers[num]
		}
	}
	
	set(num, obj) {
		if (num < 0 || num >= VMRegisters.NUM_REGISTERS) {
			throw new VMError(`Tried to write invalid register $${num}`)
		}

		if (!(obj instanceof VMObject)) {
			throw new VMError(`Tried to write an invalid object to register $${num}`)
		}

		let setter = VMRegisters.SETTER_TABLE[num]
		
		if (setter) {
			this[setter](obj)
		} else {
			this.registers[num] = obj
		}
	}
	
	setZero(obj) {
		// no-op
	}
	
	setPc(obj) {
		if (obj.type != VMObject.TYPE_PTR) {
			throw new VMError(`Tried to write a non-pointer to $PC`)
		}

		this.registers[VMRegisters.REG_PC] = obj
	}
	
	setIrsp(obj) {
		if (obj.type != VMObject.TYPE_PTR) {
			throw new VMError(`Tried to write a non-pointer to $IRSP`)
		}

		this.registers[VMRegisters.REG_IRSP] = obj
	}

	getIpop() {
		return this.vm.create(VMInt, this.vm.irsPop())
	}
	
	setIpop(obj) {
		throw new VMError(`Tried to write to $IPOP`)
	}
	
	setSp(obj) {
		if (obj.type != VMObject.TYPE_PTR) {
			throw new VMError(`Tried to write a non-pointer to $SP`)
		}

		this.registers[VMRegisters.REG_SP] = obj
	}
	
	setPush(obj) {
		this.vm.stackPush(obj)
		this.registers[VMRegisters.REG_PUSH] = obj
	}

	getPop() {
		return this.vm.stackPop()
	}
	
	setPop(obj) {
		throw new VMError(`Tried to write to $POP`)
	}
}

class VMIntMemory {
	constructor(vm, size) {
		this.vm = vm
		this.size = size
		this.data = new Int32Array(size)
	}

	read(addr) {
		if (addr < 0 || addr >= this.size) {
			throw new VMError(`Tried to read invalid address ${addr} of int memory region`)
		}

		return this.data[addr]
	}

	write(addr, num) {
		if (addr < 0 || addr >= this.size) {
			throw new VMError(`Tried to write invalid address ${addr} of int memory region`)
		}
		
		this.data[addr] = num
	}

	clear() {
		this.data.fill(0)
	}
}

class VMObjectMemory {
	constructor(vm, size) {
		this.vm = vm
		this.size = size
		this.data = Object.seal(new Array(size).fill(0))

		this.clear()
	}

	read(addr) {
		if (addr < 0 || addr >= this.size) {
			throw new VMError(`Tried to read invalid address ${addr} of object memory region`)
		}

		return this.data[addr]
	}

	write(addr, obj) {
		if (addr < 0 || addr >= this.size) {
			throw new VMError(`Tried to write invalid address ${addr} of object memory region`)
		}

		if (!(obj instanceof VMObject)) {
			throw new VMError(`Tried to write an invalid object to address ${addr} of object memory region`)
		}

		this.data[addr] = obj
	}

	clear() {
		this.data.fill(this.vm.nullObject)
	}
}

class VM {
	static MAX_ENV_KEY_LENGTH = 64

	static MAIN_MEMORY_SIZE = 0x1000000
	static STACK_SIZE = 0x10000
	static CALL_STACK_SIZE = 0x10000
	static IRS_SIZE = 0x10000
	
	static INSTR_CLASS_NOP  = 0b0000
	static INSTR_CLASS_EXIT = 0b0001
	static INSTR_CLASS_PUSH = 0b0010
	static INSTR_CLASS_POP  = 0b0011
	static INSTR_CLASS_RET  = 0b0100
	static INSTR_CLASS_GET  = 0b0101
	static INSTR_CLASS_SET  = 0b0110
	static INSTR_CLASS_B    = 0b0111
	static INSTR_CLASS_CMP  = 0b1000
	static INSTR_CLASS_CVT  = 0b1001

	static INSTR_CLASS_EXECS = {
		[VM.INSTR_CLASS_NOP]:  "execNop",
		[VM.INSTR_CLASS_EXIT]: "execExit",
		[VM.INSTR_CLASS_PUSH]: "execPush",
		[VM.INSTR_CLASS_POP]:  "execPop",
		[VM.INSTR_CLASS_RET]:  "execRet",
		[VM.INSTR_CLASS_GET]:  "execGet",
		[VM.INSTR_CLASS_SET]:  "execSet",
		[VM.INSTR_CLASS_B]:    "execB",
		[VM.INSTR_CLASS_CMP]:  "execCmp",
		[VM.INSTR_CLASS_CVT]:  "execCvt",
	}
	
	encodeStringUtf8(str) {
		let data = new Uint8Array(str.length * 3 + 1)
		let { written } = this.textEncoder.encodeInto(str, data)
		
		let view = new DataView(data.buffer)
		let arr = new Uint32Array(Math.ceil((written + 1) / 4))
		
		for (let i = 0; i < arr.length; i++) {
			arr[i] = view.getUint32(i * 4)
		}
		
		return arr
	}
	
	decodeStringUtf8(arr, maxLength) {
		let len = Math.min(arr.length, maxLength)
		let data = []
		
		for (let i = 0; i < len; i++) {
			let val = arr[i]
			
			if (val == 0) {
				break
			} else {
				data.push(val)
			}
		}
		
		return this.textDecoder.decode(new Uint8Array(data))
	}

	constructor() {
		this.textEncoder = new TextEncoder()
		this.textDecoder = new TextDecoder("utf-8", { fatal: true })

		this.stopped = false
		this.branching = false
		this.exitValue = undefined

		this.nullObject = new VMNull(this)

		this.registers = new VMRegisters(this)
		
		this.memory = new VMIntMemory(this, VM.MAIN_MEMORY_SIZE)
		this.stack = new VMObjectMemory(this, VM.STACK_SIZE)
		this.callStack = new VMIntMemory(this, VM.CALL_STACK_SIZE)
		this.irs = new VMIntMemory(this, VM.IRS_SIZE)
		
		this.csp = this.create(VMPtr, this.callStack, 0)
		
		this.env = {}

		this.reset()
	}

	reset() {
		this.stopped = false
		this.branching = false
		this.exitValue = undefined

		this.registers.reset()

		this.memory.clear()
		this.stack.clear()
		this.callStack.clear()
		this.irs.clear()
		
		this.csp.setPrimitive(0)
	}

	create(cons, ...args) {
		return new cons(this, ...args)
	}
	
	getEnvironment(key) {
		return key in this.env ? this.env[key] : null
	}
	
	setEnvironment(key, value) {
		this.env[key] = value
	}

	stackPush(obj) {
		let sp = this.registers.get(VMRegisters.REG_SP)
		sp.write(0, obj)
		this.registers.set(VMRegisters.REG_SP, this.create(VMPtr, this.stack, sp.getPrimitive() + 1))
	}

	stackPop() {
		let sp = this.create(VMPtr, this.stack, this.registers.get(VMRegisters.REG_SP).getPrimitive() - 1)
		this.registers.set(VMRegisters.REG_SP, sp)
		return sp.read(0)
	}

	callStackPush() {
		this.csp.write(0, this.registers.get(VMRegisters.REG_PC).getPrimitive() + 1)
		this.csp.setPrimitive(this.csp.getPrimitive() + 1)
	}

	callStackPop() {
		this.csp.setPrimitive(this.csp.getPrimitive() - 1)
		this.registers.set(VMRegisters.REG_PC, this.create(VMPtr, this.memory, this.csp.read(0)))
	}

	irsPush(num) {
		let irsp = this.registers.get(VMRegisters.REG_IRSP)
		irsp.write(0, num)
		this.registers.set(VMRegisters.REG_IRSP, this.create(VMPtr, this.irs, irsp.getPrimitive() + 1))
	}

	irsPop() {
		let irsp = this.create(VMPtr, this.irs, this.registers.get(VMRegisters.REG_IRSP).getPrimitive() - 1)
		this.registers.set(VMRegisters.REG_IRSP, irsp)
		return irsp.read(0)
	}
	
	loadProgram(buf) {
		this.reset()
		
		for (let i = 0; i < buf.length; i++) {
			this.memory.write(i, buf[i])
		}
	}
	
	run() {
		while (!this.stopped) {
			this.step()
		}
		
		return this.exitValue
	}
	
	step() {
		if (!this.stopped) {
			let pc = this.registers.get(VMRegisters.REG_PC)

			let instr = pc.read(0)
			this.executeInstruction(instr)

			if (!this.branching) {
				this.registers.set(VMRegisters.REG_PC, this.create(VMPtr, this.memory, pc.getPrimitive() + 1))
			}
			
			this.branching = false
		}
		
		return this.exitValue
	}

	executeInstruction(instr) {
		debug(`CursedVM: Executing instruction ${(instr >>> 0).toString(16)} (${(instr >>> 0).toString(2).padStart(32, "0").match(/.{8}/g).join(" ")})`)
		
		let instrClass = VM.INSTR_CLASS_EXECS[instr >>> 28]
		
		if (!instrClass) {
			throw new VMError(`Tried to execute instruction from reserved instruction class ${instrClass}`)
		}
		
		let s = (instr >>> 27) & 0b1
		let c0 = (instr >>> 24) & 0b111
		let c1 = (instr >>> 21) & 0b111
		let r0 = (instr >>> 16) & 0b11111
		let c2 = (instr >>> 13) & 0b111
		let r1 = (instr >>> 8) & 0b11111
		let c3 = (instr >>> 5) & 0b111
		let r2 = instr & 0b11111
		let imm = instr & 0xFFFF
		
		let data = new DataView(new ArrayBuffer(2))
		data.setInt16(0, imm)
		let immSigned = data.getInt16(0)

		if (this[instrClass](s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) && s) {
			this.irsPush(immSigned)
		}
	}
	
	execNop(s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) {
		return true
	}
	
	execExit(s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) {
		this.stopped = true

		if (c0 & 0b001) {
			this.exitValue = this.registers.get(r0)
			return false
		} else {
			this.exitValue = immSigned
			return false
		}
	}
	
	execPush(s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) {
		if (c0 & 0b001) {
			this.stackPush(this.registers.get(r0))
			return true
		} else {
			this.stackPush(this.create(VMInt, immSigned))
			return false
		}
	}
	
	execPop(s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) {
		if (c0 & 0b001) {
			this.registers.set(r0, this.create(VMInt, this.irsPop()))
			return true
		} else {
			this.registers.set(r0, this.stackPop())
			return true
		}
	}
	
	execRet(s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) {
		this.callStackPop()
		this.branching = true
		
		return true
	}
	
	execGet(s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) {
		let ptr = this.registers.get(r1)
		
		if (ptr.type != VMObject.TYPE_PTR) {
			throw new VMError(`Tried to get environment variable, but key was type ${VMObject.getTypeName(ptr.type)} instead of ptr`)
		}
		
		let key = ptr.readString(VM.MAX_ENV_KEY_LENGTH)
		
		let val = this.getEnvironment(key)
		let result
		
		if (val != null) {
			if (c0 & 0b001) {
				result = this.create(VMExt, val)
			} else {
				if (!Number.isInteger(val)) {
					throw new VMError(`Tried to get environment variable "${key}" but value is not an integer`)
				}
				
				result = this.create(VMInt, val)
			}
		} else {
			result = this.create(VMNull)
		}
		
		this.registers.set(r0, result)
		return false
	}
	
	execSet(s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) {
		let obj = this.registers.get(r0)
		
		if (obj.type != VMObject.TYPE_INT) {
			throw new VMError(`Tried to set environment variable "${key}" to value of type ${VMObject.getTypeName(obj.type)}`)
		}
		
		this.setEnvironment(key, obj.getPrimitive())
		return false
	}
	
	execB(s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) {
		let branch = true
		
		if (c1 & 0b100) {
			let comp = this.registers.get(VMRegisters.REG_COMP)
			
			if (comp.type != VMObject.TYPE_INT) {
				throw new VMError(`Tried to do a conditional branch, but comparison result register was not an int`)
			}
			
			branch &&= comp.getPrimitive()
		}
		
		let useRegister = c0 & 0b001
		
		if (branch) {
			let absolute = c0 & 0b010
			let call = c0 & 0b100
			
			if (call && !absolute) {
				throw new VMError(`Invalid relative call instruction`)
			}
			
			let target
			
			if (useRegister) {
				let reg = this.registers.get(r0)
				
				if (call && reg.type == VMObject.TYPE_EXT) {
					reg.value(this)
					return useRegister
				}
				
				if (!(reg.type == VMObject.TYPE_INT || absolute && reg.type == VMObject.TYPE_PTR)) {
					throw new VMError(`Invalid register type ${VMObject.getTypeName(reg.type)} for branch. Branch type: ${c0}`)
				}
				
				target = reg.getPrimitive()
			} else {
				target = immSigned
			}
			
			if (call) {
				this.callStackPush()
			}
			
			let pc = this.registers.get(VMRegisters.REG_PC)
			
			if (!absolute) {
				target += pc.getPrimitive()
			}
			
			this.registers.set(VMRegisters.REG_PC, this.create(VMPtr, this.memory, target))
			this.branching = true
		}
		
		return useRegister
	}
	
	execCmp(s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) {
		let regMode = c1 & 0b001

		let reg0 = this.registers.get(r0)
		let val0
		
		if (!VMObject.isTypeNumericOrPtr(reg0.type)) {
			throw new VMError(`Invalid register type ${VMObject.getTypeName(reg0.type)} for comparison`)
		}
		
		val0 = reg0.getPrimitive()
		
		let reg1
		let val1
		
		if (regMode) {
			reg1 = this.registers.get(r2)
			
			if (!VMObject.isTypeNumericOrPtr(reg1.type)) {
				throw new VMError(`Invalid register type ${VMObject.getTypeName(reg1.type)} for comparison`)
			}
			
			if ((reg0.type == VMObject.TYPE_PTR) ^ (reg1.type == VMObject.TYPE_PTR)) {
				throw new VMError(`Cannot compare ${VMObject.getTypeName(reg0.type)} and ${VMObject.getTypeName(reg1.type)}`)
			}
			
			val1 = reg1.getPrimitive()
		} else {
			if (reg0.type == VMObject.TYPE_PTR) {
				throw new VMError(`Cannot compare ${VMObject.getTypeName(reg0.type)} and immediate`)
			}
			
			val1 = immSigned
		}
		
		if (reg0.type == VMObject.TYPE_PTR && reg1.type == VMObject.TYPE_PTR && reg0.memory != reg1.memory) {
			throw new VMError(`Cannot compare pointers to different memory regions`)
		}
		
		let destReg = regMode && s ? r1 : VMRegisters.REG_COMP
		
		switch (c0) {
			case 0b000:
				this.registers.set(destReg, this.create(VMInt, val0 < val1 ? -1 : val0 > val1 ? 1 : 0))
				return false

			case 0b001:
				this.registers.set(destReg, this.create(VMInt, val0 == val1))
				return false

			case 0b010:
				this.registers.set(destReg, this.create(VMInt, val0 < val1))
				return false

			case 0b011:
				if (regMode) {
					throw new VMError(`Reserved comparison`)
				}
				
				this.registers.set(destReg, this.create(VMInt, val0 > val1))
				return false

			case 0b100:
				if (regMode) {
					this.registers.set(destReg, this.create(VMInt, reg0 == reg1))
					return false
				}
				
				this.registers.set(destReg, this.create(VMInt, !val0))
				return true

			case 0b101:
				this.registers.set(destReg, this.create(VMInt, val0 != val1))
				return false

			case 0b110:
				this.registers.set(destReg, this.create(VMInt, val0 >= val1))
				return false

			case 0b111:
				if (regMode) {
					throw new VMError(`Reserved comparison`)
				}
				
				this.registers.set(destReg, this.create(VMInt, val0 <= val1))
				return false
		}
	}

	execCvt(s, r0, r1, r2, c0, c1, c2, c3, imm, immSigned) {
		let regMode = c1 & 0b001
		
		if (c0 == VMObject.TYPE_NULL) {
			this.registers.set(r0, this.create(VMNull))
			return !regMode
		}
		
		if (regMode) {
			let srcObj = this.registers.get(r2)
			
			if (s) {
				srcObj = srcObj.reinterpret(r1)
			}
			
			if (c0 == 0b111) {
				if (srcObj.type != VMObject.TYPE_PTR) {
					throw new VMError(`Cannot dereference object of type ${VMObject.getTypeName(srcObj.type)}`)
				}
				
				this.registers.set(r0, srcObj.read(0))
			} else {
				this.registers.set(r0, srcObj.convert(c0))
			}
		} else {
			switch (c0) {
				case VMObject.TYPE_INT:
					this.registers.set(r0, this.create(VMInt, immSigned))
					break
				
				case VMObject.TYPE_FLOAT:
					this.registers.set(r0, this.create(VMFloat, immSigned))
					break
				
				case VMObject.TYPE_PTR:
					this.registers.set(r0, this.create(VMPtr, this.memory, immSigned))
					break
				
				case VMObject.TYPE_EXT:
					throw new VMError(`Cannot convert object type to external object`)
					break
				
				default:
					throw new VMError(`Tried to convert to unrecognized type ${VMObject.getTypeName(c0)}`)
			}
		}
		
		return false
	}
}

let vm = new VM()

vm.setEnvironment("println", (vm) => {
	console.log(vm.stackPop().readString())
})

/**
 * 00: 1001?011 ??011110 00000000 00001110 | cvt.ptr.i $PUSH, 0x000E
 * 01: 1001?011 ??000011 00000000 00000100 | cvt.ptr.i $3, 0x0004
 * 02: 01111111 0??00011 00000000 00001100 | call.r $3 [ipush 0x000C]
 * 03: 0001???0 ???????? 00000000 00000000 | exit.i 0x0000
 * 04: 10010011 ??100100 ???????? ???11100 | cvt.ptr.r $4, $IPOP
 * 05: 0101???1 ???00100 ???00100 ???????? | load $4, $4
 * 06: 10010011 ??111110 ???????? ???11110 | cvt.ptr.r $PUSH, $PUSH
 * 07: 01111111 0??00100 00000000 00000110 | call.r $4 [ipush 0x0000]
 * 08: 10010001 ??100101 ???????? ???11011 | cvt.int.r $5, $IRSP
 * 09: 1000?010 ??000101 00000000 00000001 | c.lt.i $5, 0x0001 // Change 1 to 10 to print Hello World 10 times
 * 0A: 01111111 1??00011 00000000 00001100 | callc.r $3 [ipush 0x000C]
 * 0B: 01000??? ???????? ???????? ???????? | ret
 * 0C:        p        r        i        n | "println"
 * 0D:        t        l        n       \0 |
 * 0E:        H        e        l        l | "Hello World"
 * 0F:        o                 W        o |
 * 10:        r        l        d       \0 |
 */
vm.loadProgram([
	0x931e000e,
	0x93030004,
	0x7f03000c,
	0x10000000,
	0x9324001c,
	0x51040400,
	0x933e001e,
	0x7f040006,
	0x9125001b,
	0x82050001,
	0x7f83000c,
	0x40000000,
	...vm.encodeStringUtf8("println"),
	...vm.encodeStringUtf8("Hello World")
])

vm.run()