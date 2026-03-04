"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EyeOff, Send, Gift, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useTagdeer } from '@/context/TagdeerContext';

export default function MerchantInbox() {
    const { user, businesses, supabase, showToast } = useTagdeer();
    const [selectedChat, setSelectedChat] = useState(null);
    const [unresolvedComplaints, setUnresolvedComplaints] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const [showCouponModal, setShowCouponModal] = useState(false);
    const [merchantCoupons, setMerchantCoupons] = useState([]);

    const myBusiness = user && businesses ? businesses.find(b => b.owner_id === user?.id) : null;

    // Fetch active coupons for modal
    useEffect(() => {
        if (!supabase || !myBusiness) return;
        const fetchCoupons = async () => {
            const { data } = await supabase
                .from('merchant_coupons')
                .select('*')
                .eq('business_id', myBusiness.id)
                .eq('status', 'active');
            if (data) setMerchantCoupons(data);
        };
        fetchCoupons();
    }, [supabase, myBusiness]);
    // 1. Fetch complaints for the sidebar
    useEffect(() => {
        if (!supabase || !myBusiness) {
            setIsLoading(false);
            return;
        }

        const fetchComplaints = () => {
            // Retrieve complains directly from the business logs mapping in context
            const complains = (myBusiness.logs || []).filter(l => l.type === 'complain');

            // Map them to the UI structure
            const mapped = complains.map(c => ({
                id: c.id,
                log_id: c.id,
                user: c.is_verified ? 'VIP' : `Anon`,
                reason: 'Complaint',
                comment: c.text,
                date: c.date,
                status: 'unresolved', // Default until thread fetching validates
                thread_id: null
            }));
            setUnresolvedComplaints(mapped);
            setIsLoading(false);
        };
        fetchComplaints();
    }, [supabase, myBusiness]);

    // 2. Load messages whenever a chat is selected
    useEffect(() => {
        if (!selectedChat || !supabase || !myBusiness || !user) return;

        const loadMessages = async () => {
            try {
                // Optimistically clear old messages
                setMessages([]);

                // 2a. Fetch or Create Thread
                let { data: thread, error: threadErr } = await supabase
                    .from('resolution_threads')
                    .select('id, status')
                    .eq('log_id', selectedChat.log_id)
                    .single();

                if (threadErr && threadErr.code === 'PGRST116') {
                    // Thread doesn't exist, create it privately for this complaint
                    const { data: newThread, error: insertErr } = await supabase
                        .from('resolution_threads')
                        .insert([{
                            log_id: selectedChat.log_id,
                            business_id: myBusiness.id,
                            merchant_id: myBusiness.owner_id
                        }])
                        .select('id, status')
                        .single();

                    if (insertErr) throw insertErr;
                    thread = newThread;
                }

                if (thread) {
                    // Update the selected chat with the valid thread ID so sending messages works
                    setSelectedChat(prev => ({ ...prev, thread_id: thread.id, status: thread.status }));

                    // 2b. Fetch Messages
                    const { data: msgs, error: msgsErr } = await supabase
                        .from('resolution_messages')
                        .select('*')
                        .eq('thread_id', thread.id)
                        .order('created_at', { ascending: true });

                    if (msgsErr) throw msgsErr;

                    if (msgs) {
                        setMessages(msgs.map(m => ({
                            id: m.id,
                            sender: m.sender_role,
                            text: m.message,
                            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            isCoupon: !!m.coupon_id
                        })));
                    }
                }
            } catch (err) {
                console.error("Resolution Thread Error:", err);
                showToast("Failed to load chat history. Ensure DB migration is pushed.");
            }
        };

        loadMessages();
    }, [selectedChat?.log_id, supabase, myBusiness, user]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat?.thread_id || !supabase || !user) return;

        const msgText = newMessage;
        setNewMessage('');

        // Optimistic UI insert
        const tempId = Date.now();
        setMessages(prev => [...prev, {
            id: tempId,
            sender: 'merchant',
            text: msgText,
            time: 'Sending...'
        }]);

        try {
            const { data, error } = await supabase.from('resolution_messages').insert([{
                thread_id: selectedChat.thread_id,
                sender_id: user.id,
                sender_role: 'merchant',
                message: msgText
            }]).select().single();

            if (error) throw error;

            // Update optimistic with real data
            if (data) {
                setMessages(prev => prev.map(m => m.id === tempId ? {
                    id: data.id,
                    sender: data.sender_role,
                    text: data.message,
                    time: new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                } : m));
            }
        } catch (err) {
            console.error("Message send error:", err);
            showToast("Failed to send message");
            setMessages(prev => prev.filter(m => m.id !== tempId)); // Remove failed optimistic
        }
    };

    const handleAttachCoupon = async (coupon) => {
        if (!selectedChat?.thread_id || !supabase || !user) return;

        setShowCouponModal(false);

        // Optimistic
        const msgText = `Apology Attached: ${coupon.title || (coupon.discount_value + '% Discount')}`;
        const tempId = Date.now();
        setMessages(prev => [...prev, {
            id: tempId,
            sender: 'merchant',
            isCoupon: true,
            text: msgText,
            time: 'Sending...'
        }]);

        try {
            const { data, error } = await supabase.from('resolution_messages').insert([{
                thread_id: selectedChat.thread_id,
                sender_id: user.id,
                sender_role: 'merchant',
                message: msgText,
                coupon_id: coupon.id
            }]).select().single();

            if (error) throw error;

            if (data) {
                setMessages(prev => prev.map(m => m.id === tempId ? {
                    id: data.id,
                    sender: data.sender_role,
                    isCoupon: true,
                    text: data.message,
                    time: new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                } : m));
            }
        } catch (err) {
            showToast("Failed to attach apology coupon");
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    if (isLoading || user === undefined) {
        return <div className="min-h-screen flex items-center justify-center">Loading Inbox...</div>;
    }

    if (!myBusiness) {
        return <div className="min-h-screen flex items-center justify-center text-slate-500">You must claim a business to access the inbox.</div>;
    }

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
                                        {messages.length === 0 && (
                                            <div className="text-center text-slate-400 py-10">
                                                No messages yet. Send a reply to start the resolution.
                                            </div>
                                        )}
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
                                                    <div className={`max-w-[75%] rounded-2xl p-4 ${msg.sender === 'merchant'
                                                        ? 'bg-slate-800 text-white rounded-tr-sm dark:bg-slate-700'
                                                        : 'bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm'
                                                        }`}>
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
                                            onClick={() => setShowCouponModal(true)}
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

            {/* Coupon Selection Modal */}
            {showCouponModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in p-4">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
                        <h2 className="text-xl font-bold text-white mb-2">Attach Apology Coupon</h2>
                        <p className="text-sm text-slate-400 mb-6">Select an active campaign to offer to the customer privately.</p>

                        <div className="space-y-3 max-h-64 overflow-y-auto mb-6 pr-2">
                            {merchantCoupons.length === 0 ? (
                                <p className="text-slate-500 text-center py-6 border border-dashed border-slate-700 rounded-xl">No active campaigns found.<br /><span className="text-xs">Create one in the Coupons tab first.</span></p>
                            ) : (
                                merchantCoupons.map(coupon => (
                                    <button
                                        key={coupon.id}
                                        onClick={() => handleAttachCoupon(coupon)}
                                        className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 transition-colors flex items-center justify-between group"
                                    >
                                        <div>
                                            <p className="font-bold text-white group-hover:text-emerald-400 transition-colors">{coupon.title || 'Special Discount'}</p>
                                            <p className="text-xs text-slate-400 mt-1">Value: {coupon.discount_value}%</p>
                                        </div>
                                        <Gift className="w-5 h-5 text-slate-500 group-hover:text-emerald-500" />
                                    </button>
                                ))
                            )}
                        </div>

                        <Button
                            variant="outline"
                            className="w-full bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white"
                            onClick={() => setShowCouponModal(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
