"use client";

import { useState } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EyeOff, Send, Gift, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function MerchantInbox() {
    const [selectedChat, setSelectedChat] = useState(null);

    // Mock Data
    const unresolvedComplaints = [
        {
            id: 1,
            user: 'VIP-A7X9',
            reason: 'Cleanliness',
            comment: 'The tables were not wiped down when we arrived.',
            date: '2 hours ago',
            status: 'unresolved'
        },
        {
            id: 2,
            user: 'VIP-M9L1',
            reason: 'Speed',
            comment: 'Waited 45 mins for a simple order.',
            date: '1 day ago',
            status: 'unresolved'
        }
    ];

    const [messages, setMessages] = useState([
        { id: 1, sender: 'user', text: 'The tables were not wiped down when we arrived. Disappointing experience.', time: '2:30 PM' }
    ]);

    const [newMessage, setNewMessage] = useState('');

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setMessages([...messages, {
            id: Date.now(),
            sender: 'merchant',
            text: newMessage,
            time: 'Just now'
        }]);
        setNewMessage('');
    };

    const handleAttachCoupon = () => {
        setMessages([...messages, {
            id: Date.now(),
            sender: 'merchant',
            isCoupon: true,
            text: 'Apology Accepted: Free Dessert on next visit',
            time: 'Just now'
        }]);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">

                <div className="mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Resolution Inbox
                    </h1>
                    <p className="text-slate-500 mt-1">Privately resolve complaints and flip your Health Score.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[700px]">

                    {/* Left Sidebar: Complaint List */}
                    <Card className="col-span-1 border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
                        <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4">
                            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Pending Resolutions ({unresolvedComplaints.length})</h2>
                        </CardHeader>
                        <ScrollArea className="flex-1">
                            <div className="p-3 space-y-2">
                                {unresolvedComplaints.map((complaint) => (
                                    <button
                                        key={complaint.id}
                                        onClick={() => setSelectedChat(complaint)}
                                        className={`w-full text-left p-4 rounded-xl transition-all border ${selectedChat?.id === complaint.id
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm'
                                            : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="w-8 h-8">
                                                    <AvatarFallback className="bg-slate-200 text-slate-600 text-xs">VIP</AvatarFallback>
                                                </Avatar>
                                                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Anonymous</span>
                                            </div>
                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {complaint.date}
                                            </span>
                                        </div>
                                        <div className="mb-2 inline-block px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-500/20 text-xs rounded-md">
                                            Reason: {complaint.reason}
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                            {complaint.comment}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </Card>

                    {/* Right Side: Chat Interface */}
                    <Card className="col-span-1 md:col-span-2 border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
                        {selectedChat ? (
                            <>
                                {/* Chat Header */}
                                <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="w-10 h-10 border-2 border-slate-200 dark:border-slate-700">
                                            <AvatarFallback className="bg-slate-200 text-slate-600">
                                                <EyeOff className="w-5 h-5 text-slate-500" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                                                Discussing: {selectedChat.reason}
                                            </h2>
                                            <p className="text-xs text-slate-500">ID: {selectedChat.user}</p>
                                        </div>
                                    </div>
                                </CardHeader>

                                {/* Privacy Warning Banner */}
                                <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 p-3 flex items-start gap-3">
                                    <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-sm text-amber-800 dark:text-amber-500">
                                        <strong>Double-Blind Chat:</strong> You are speaking to an anonymous Tagdeer VIP. Their identity is protected to ensure honest feedback. Fix the issue to have this complaint removed from your public Health Score!
                                    </p>
                                </div>

                                {/* Chat History */}
                                <ScrollArea className="flex-1 p-6">
                                    <div className="space-y-6">
                                        {messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex flex-col ${msg.sender === 'merchant' ? 'items-end' : 'items-start'}`}
                                            >
                                                {msg.isCoupon ? (
                                                    // Special Coupon Message
                                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm p-4 max-w-[80%] shadow-md">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Gift className="w-5 h-5 text-yellow-300" />
                                                            <span className="font-bold">Apology Attached</span>
                                                        </div>
                                                        <p className="text-blue-100">{msg.text}</p>
                                                        <p className="text-[10px] text-blue-200 mt-2 italic text-right">
                                                            Waiting for user to Accept & Revert...
                                                        </p>
                                                    </div>
                                                ) : (
                                                    // Normal Text Message
                                                    <div
                                                        className={`max-w-[75%] rounded-2xl p-4 ${msg.sender === 'merchant'
                                                            ? 'bg-slate-800 text-white rounded-tr-sm dark:bg-slate-700'
                                                            : 'bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm'
                                                            }`}
                                                    >
                                                        <p>{msg.text}</p>
                                                    </div>
                                                )}
                                                <span className="text-xs text-slate-400 mt-1">{msg.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                {/* Chat Input */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                                    <form onSubmit={handleSendMessage} className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleAttachCoupon}
                                            title="Attach Resolution Coupon"
                                            className="shrink-0 border-dashed border-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                        >
                                            <Gift className="w-5 h-5 mr-2" />
                                            Attach Apology
                                        </Button>
                                        <Input
                                            placeholder="Type your reply..."
                                            className="flex-1"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                        />
                                        <Button type="submit" className="shrink-0 group bg-slate-800 hover:bg-slate-900">
                                            <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            // Empty State
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center mb-6">
                                    <CheckCircle2 className="w-12 h-12" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Inbox Zero!</h3>
                                <p className="text-slate-500 max-w-md">
                                    You have no selected complaints. Select a pending resolution from the sidebar to chat with the customer and protect your Health Score.
                                </p>
                            </div>
                        )}
                    </Card>

                </div>
            </div>
        </div>
    );
}
