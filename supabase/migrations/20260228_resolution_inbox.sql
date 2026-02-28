-- ==========================================
-- Phase 18.0: Resolution Inbox Schema
-- ==========================================

-- 1. Create Resolution Threads Table
CREATE TABLE IF NOT EXISTS public.resolution_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_id UUID NOT NULL, -- Logical reference to logs/interactions
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consumer_id UUID, -- Can be null for anonymous complaints
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(log_id) -- One thread per complaint
);

-- 2. Create Resolution Messages Table
CREATE TABLE IF NOT EXISTS public.resolution_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.resolution_threads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('merchant', 'consumer')),
    message TEXT NOT NULL,
    coupon_id UUID REFERENCES public.merchant_coupons(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.resolution_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resolution_messages ENABLE ROW LEVEL SECURITY;

-- 4. Thread Policies
CREATE POLICY "Merchants view their own threads" 
    ON public.resolution_threads FOR SELECT 
    USING (merchant_id = auth.uid());

CREATE POLICY "Consumers view their own threads" 
    ON public.resolution_threads FOR SELECT 
    USING (consumer_id = auth.uid());

CREATE POLICY "Merchants create threads" 
    ON public.resolution_threads FOR INSERT 
    WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants update threads" 
    ON public.resolution_threads FOR UPDATE 
    USING (merchant_id = auth.uid());

-- 5. Message Policies
CREATE POLICY "Participants view messages" 
    ON public.resolution_messages FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.resolution_threads t
            WHERE t.id = resolution_messages.thread_id 
              AND (t.merchant_id = auth.uid() OR t.consumer_id = auth.uid())
        )
    );

CREATE POLICY "Participants insert messages" 
    ON public.resolution_messages FOR INSERT 
    WITH CHECK (sender_id = auth.uid());
