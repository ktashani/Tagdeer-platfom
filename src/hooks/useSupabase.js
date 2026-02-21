import { useState, useEffect } from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ipjvgbxkouadovjqwncx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwanZnYnhrb3VhZG92anF3bmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTEwODgsImV4cCI6MjA4NzE4NzA4OH0._t52YKSYIjnqFmBycXEkmq3nJnXnVrKB0H3ZD8ju14s';

export function useSupabase() {
  const [supabase, setSupabase] = useState(null);

  useEffect(() => {
    if (window.supabase) {
      setSupabase(window.supabase.createClient(supabaseUrl, supabaseAnonKey));
      return;
    }
    
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.async = true;
    script.onload = () => {
      setSupabase(window.supabase.createClient(supabaseUrl, supabaseAnonKey));
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return { supabase };
}
