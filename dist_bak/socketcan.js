"use strict";
/* Copyright Sebastian Haas <sebastian@sebastianhaas.info>. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kcd = exports.parseNetworkDescription = exports.DatabaseService = exports.Message = exports.Signal = exports.createRawChannelWithOptions = exports.createRawChannel = void 0;
// -----------------------------------------------------------------------------
// CAN-Object
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./can.d.ts" />
const can = __importStar(require("../build/Release/can.node"));
// -----------------------------------------------------------------------------
/**
 * The Signals modules provides an interface to access the values/signals
 * encoded in CAN messages.
 * @module Signals
 */
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./can_signals.d.ts" />
const _signals = __importStar(require("../build/Release/can_signals.node"));
// import * as _signals from "can_signals";
const kcd = __importStar(require("./parse_kcd"));
exports.kcd = kcd;
/**
 * @method createRawChannel
 * @param channel {string} Channel name (e.g. vcan0)
 * @param timestamps {bool} Whether or not timestamps shall be generated when reading a message
 * @param protocol {integer} optionally provide another default protocol value (default is CAN_RAW)
 * @return {RawChannel} a new channel object or exception
 * @for exports
 */
function createRawChannel(channel, timestamps, protocol) {
    return new can.RawChannel(channel, timestamps, protocol, false);
}
exports.createRawChannel = createRawChannel;
/**
 * @method createRawChannelWithOptions
 * @param channel {string} Channel name (e.g. vcan0)
 * @param options {dict} list of options (timestamps, protocol, non_block_send)
 * @return {RawChannel} a new channel object or exception
 * @for exports
 */
function createRawChannelWithOptions(channel, options) {
    if (options === undefined)
        options = {};
    if (options.timestamps === undefined)
        options.timestamps = false;
    if (options.protocol === undefined)
        options.protocol = 1; /* CAN RAW */
    if (options.non_block_send === undefined)
        options.non_block_send = false;
    return new can.RawChannel(channel, options.timestamps, options.protocol, options.non_block_send);
}
exports.createRawChannelWithOptions = createRawChannelWithOptions;
/**
 * The actual signal.
 * @class Signal
 */
class Signal extends kcd.Signal {
    constructor(desc) {
        super(desc.name, desc.spn, desc.bitOffset, desc.bitLength, desc.endianess, desc.labels, desc.mux, desc.slope, desc.intercept, desc.unit, desc.type, desc.defaultValue, desc.minValue, desc.maxValue);
        this.value = undefined;
        this.changeListeners = [];
        this.updateListeners = [];
        /**
         * this will allow triggering on mux'ed message ids.
         */
        this.muxGroup = [desc.mux];
    }
    /**
     * Keep track of listeners who want to be notified if this signal changes
     * @method onChange
     * @param listener JS callback to get notification
     * @for Signal
     */
    onChange(listener) {
        this.changeListeners.push(listener);
        return listener;
    }
    /**
     * Keep track of listeners who want to be notified if this signal updates
     * @method onUpdate
     * @param listener JS callback to get notification
     * @for Signal
     */
    onUpdate(listener) {
        this.updateListeners.push(listener);
        return listener;
    }
    /**
     * Remove listener from signal onChange and/or onUpdate
     * @method removeListener
     * @param listener to be removed
     * @for Signal
     */
    removeListener(listener) {
        let idx = this.changeListeners.indexOf(listener);
        if (idx >= 0)
            this.changeListeners.splice(idx, 1);
        idx = this.updateListeners.indexOf(listener);
        if (idx >= 0)
            this.updateListeners.splice(idx, 1);
    }
    /**
     * Set new value of this signal. Any local registered clients will
     * receive a notification. Please note, no CAN message is actually
     * send to the bus (@see DatabaseServer::send)
     * @method update
     * @param newValue {bool|double|integer} New value to set
     * @for Signal
     */
    update(newValue) {
        // TODO: Move this block to a `Value.isValid(v)` function?
        if (this.maxValue && newValue > this.maxValue) {
            console.error(`ERROR : ${this.name} value = ${newValue} is out of bounds > ${this.maxValue}`);
        }
        if (this.minValue && newValue < this.minValue) {
            console.error(`ERROR : ${this.name} value = ${newValue} is out of bounds < ${this.minValue}`);
        }
        const changed = this.value !== newValue;
        this.value = newValue;
        // Update all updateListeners, that the signal updated
        this.updateListeners.forEach((listener) => {
            listener(this);
        });
        // Nothing changed
        if (!changed)
            return;
        // Update all changelisteners, that the signal changed
        this.changeListeners.forEach((listener) => {
            listener(this);
        });
    }
}
exports.Signal = Signal;
// -----------------------------------------------------------------------------
/**
 * Just a container to keep the Signals.
 * @class Message
 */
class Message {
    constructor(msgDef) {
        this.signals = {};
        this.updateListeners = [];
        /**
         * CAN identifier
         * @attribute id
         * @final
         */
        this.id = msgDef.id;
        /**
         * Extended Frame Format used
         * @attribute ext
         * @final
         */
        this.ext = msgDef.ext;
        /**
         * Symbolic name
         * @attribute name
         * @final
         */
        this.name = msgDef.name;
        /**
         * Length in bytes of resulting CAN message
         *
         * @attribute len
         * @final
         */
        this.len = msgDef.length;
        /**
         * This is the time frame that the message gets generated
         *
         * @attribute interval
         * @final
         */
        this.interval = msgDef.interval;
        /**
         * This tells us the message is mutliplexed.
         *
         * @attribute muxed
         * @final
         */
        this.muxed = msgDef.muxed;
        /**
         * Multiplexor parameter (just one supported right now).
         *
         * @attribute mux
         * @final
         */
        this.mux = msgDef.mux;
        /**
         * Named information to inform that the frame is CAN_FD format .
         * @attribute Boolean
         * @final
         */
        // this.canfd = msgDef.canfd;
        msgDef.signals.forEach((s) => {
            if (this.signals[s.name] && this.signals[s.name].muxGroup) {
                this.signals[s.name].muxGroup.push(s.mux);
            }
            else {
                this.signals[s.name] = new Signal(s);
            }
        });
    }
    /**
     * Keep track of listeners who want to be notified if this message is received/decoded.
     * @method onMessageUpdate
     * @param listener JS callback to get notification
     * @for Message
     */
    onMessageUpdate(listener) {
        this.updateListeners.push(listener);
        return listener;
    }
    /**
     * Remove the message listener.
     * @method removeListener
     * @param listener to be removed
     * @for Message
     */
    removeListener(listener) {
        let idx = this.updateListeners.indexOf(listener);
        if (idx >= 0)
            this.updateListeners.splice(idx, 1);
    }
    /**
     * Called internally to let the message listener know that the message was received.
     * @method update
     * @for Message
     */
    update() {
        this.updateListeners.forEach((listener) => {
            listener(this);
        });
    }
}
exports.Message = Message;
// -----------------------------------------------------------------------------
/**
 * A DatabaseService is usually generated once per bus to collect signals
 * coded in the CAN messages according a DB description.
 * @class DatabaseService
 * @constructor DatabaseService
 * @param channel RAW channel
 * @param db_desc Set of rules to decode/encode signals (@parse_kcd.js)
 * @return a new DatabaseService
 * @for DatabaseService
 */
class DatabaseService {
    constructor(channel, busDef) {
        this.channel = channel;
        this.messages = {};
        busDef.messages.forEach((m) => {
            const id = m.id | ((m.ext ? 1 : 0) << 31);
            const nm = new Message(m);
            this.messages[id] = nm;
            this.messages[m.name] = nm;
        });
        // Subscribe to any incoming messages
        channel.addListener("onMessage", this.onMessage, this);
    }
    // Callback for incoming messages
    onMessage(msg) {
        if (msg == undefined)
            return;
        // RTR (Remote-Transmit-Request) dont have payload
        if (msg.rtr)
            return;
        const id = msg.id | ((msg.ext ? 1 : 0) << 31);
        const m = this.messages[id];
        if (!m) {
            return;
        }
        let mux_count = -1;
        if (m.muxed && m.mux) {
            const b_mux = _signals.decodeSignal(msg.data, m.mux.offset, m.mux.length, true, false);
            mux_count = b_mux[0] + (b_mux[1] << 32);
        }
        // Let the C-Portition extract and convert the signal
        for (const i in m.signals) {
            const s = m.signals[i];
            // if this is a mux signal and the muxor isnt in my list...
            if (m.muxed && s.muxGroup.indexOf(mux_count) == -1) {
                continue;
            }
            const ret = _signals.decodeSignal(msg.data, s.bitOffset, s.bitLength, s.endianess == "little", s.type == "signed");
            let val = ret[0] + (ret[1] << 32);
            if (s.slope)
                val *= s.slope;
            if (s.intercept)
                val += s.intercept;
            s.update(val);
        }
        // Let the message listener know that the message was received.
        m.update();
    }
    /**
     * Construct a CAN message and encode all related signals according
     * the rules. Finally send the message to the bus.
     * @method send
     * @param msg_name Name of the message to generate (indicate mux by append .MUX_VALUE in hex)
     * @for DatabaseService
     */
    send(msg_name) {
        const args = msg_name.split("."); // allow for mux'ed messages sent.
        const m = this.messages[args[0]];
        const mux = args.length > 1 ? args[1] : undefined;
        if (!m)
            throw msg_name + " not defined";
        const canmsg = {
            id: m.id,
            ext: m.ext,
            rtr: false,
            // for CANFD data buffer 64 bytes
            data: m.len > 0 && m.len < 64 ? Buffer.alloc(m.len) : Buffer.alloc(64),
        };
        canmsg.data.fill(0); // should be 0xFF for j1939 message def.
        if (mux && m.mux)
            _signals.encodeSignal(canmsg.data, m.mux.offset, m.mux.length, true, false, parseInt(mux, 16));
        Object.values(m.signals).forEach((s) => {
            if (s.value == undefined)
                return;
            if (mux) {
                if (s.muxGroup.indexOf(parseInt(mux, 16)) === -1) {
                    return;
                }
            }
            let val = s.value;
            // Apply factor/intercept and convert to Integer
            val -= s.intercept;
            val /= s.slope;
            // Make sure we are sending an integer because the division above could change it to a float.
            val = Math.round(val);
            if (m.len == 0) {
                return;
            }
            const word1 = val & 0xffffffff;
            let word2 = 0;
            // shift doesn't work above 32 bit, only do this if required to save cycles
            if (val > 0xffffffff) {
                word2 = val / Math.pow(2, 32);
            }
            _signals.encodeSignal(canmsg.data, s.bitOffset, s.bitLength, s.endianess == "little", s.type == "signed", word1, word2);
        });
        this.channel.send(canmsg);
    }
}
exports.DatabaseService = DatabaseService;
/**
 * @method parseNetworkDescription
 * @param file {string} Path to KCD file to parse
 * @return DB description to be used in DatabaseService
 * @for exports
 */
exports.parseNetworkDescription = kcd.parseKcdFile;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic29ja2V0Y2FuLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3NvY2tldGNhbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsZ0ZBQWdGO0FBQ2hGLGFBQWE7QUFFYixxRUFBcUU7QUFDckUsbUNBQW1DO0FBQ25DLCtEQUFpRDtBQUVqRCxnRkFBZ0Y7QUFDaEY7Ozs7R0FJRztBQUNILHFFQUFxRTtBQUNyRSwyQ0FBMkM7QUFDM0MsNEVBQThEO0FBRTlELDJDQUEyQztBQUUzQyxpREFBbUM7QUFvYzFCLGtCQUFHO0FBbGNaOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQixnQkFBZ0IsQ0FDL0IsT0FBZSxFQUNmLFVBQW9CLEVBQ3BCLFFBQWlCO0lBRWpCLE9BQU8sSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2pFLENBQUM7QUFORCw0Q0FNQztBQVFEOzs7Ozs7R0FNRztBQUNILFNBQWdCLDJCQUEyQixDQUMxQyxPQUFlLEVBQ2YsT0FBdUI7SUFFdkIsSUFBSSxPQUFPLEtBQUssU0FBUztRQUFFLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFFeEMsSUFBSSxPQUFPLENBQUMsVUFBVSxLQUFLLFNBQVM7UUFBRSxPQUFPLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUNqRSxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssU0FBUztRQUFFLE9BQU8sQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUMsYUFBYTtJQUN2RSxJQUFJLE9BQU8sQ0FBQyxjQUFjLEtBQUssU0FBUztRQUFFLE9BQU8sQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDO0lBRXpFLE9BQU8sSUFBSSxHQUFHLENBQUMsVUFBVSxDQUN4QixPQUFPLEVBQ1AsT0FBTyxDQUFDLFVBQVUsRUFDbEIsT0FB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