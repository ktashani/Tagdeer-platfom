'use client';

import React from 'react';
import { useTagdeer } from '@/context/TagdeerContext';

export default function PrivacyPage() {
    const { lang, isRTL } = useTagdeer();
    const isAr = lang === 'ar';

    return (
        <div className="bg-gray-50 min-h-screen py-12" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="max-w-4xl mx-auto px-4 sm:px-6">

                {/* Header Section */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3">
                        {isAr ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy & Data Protection'}
                    </h1>
                    <p className="text-gray-500 font-medium">
                        {isAr ? 'تاريخ السريان: [Current Date]' : 'Effective Date: [Current Date]'}
                    </p>
                </div>

                {/* 1. Introduction Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-blue-600 mb-4">
                        {isAr ? '1. مقدمة' : '1. Introduction'}
                    </h2>
                    <p className="text-gray-700 leading-relaxed">
                        {isAr
                            ? 'مرحباً بك في منصة تقدير (tagdeer.app). توضح سياسة الخصوصية هذه كيف نقوم بجمع بياناتك الشخصية ومعالجتها وحمايتها. باستخدامك لمنصة تقدير، فإنك توافق على ممارسات البيانات الموضحة في هذه السياسة. هدفنا الأساسي هو تعزيز بيئة تقييم مجتمعية شفافة وحقيقية في ليبيا.'
                            : 'Welcome to Tagdeer (tagdeer.app). This Privacy Policy explains how we collect, process, and protect your personal data. By using the Tagdeer platform, you consent to the data practices described in this policy. Our primary goal is to foster a transparent and authentic community review ecosystem in Libya.'}
                    </p>
                </div>

                {/* 2. Information We Collect Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-blue-600 mb-4">
                        {isAr ? '2. المعلومات التي نجمعها' : '2. Information We Collect'}
                    </h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        {isAr
                            ? 'لضمان نزاهة "محرك الثقة" الخاص بنا، نجمع البيانات الضرورية فقط:'
                            : 'To ensure the integrity of our "Trust Engine," we collect strictly necessary data:'}
                    </p>
                    <ul className="list-disc list-inside space-y-3 text-gray-700 leading-relaxed">
                        <li>
                            <strong className="text-slate-900">{isAr ? 'بيانات الحساب: ' : 'Account Data: '}</strong>
                            {isAr
                                ? 'رقم هاتفك المحمول، والذي يتم التحقق منه بأمان عبر رسائل واتساب.'
                                : 'Your mobile phone number, which is authenticated securely via WhatsApp OTP.'}
                        </li>
                        <li>
                            <strong className="text-slate-900">{isAr ? 'نشاط المنصة: ' : 'Platform Activity: '}</strong>
                            {isAr
                                ? 'سجل تصويتاتك، ومراجعاتك، والتوقيت الزمني، ومعدل تفاعلك مع الأنشطة التجارية المحلية.'
                                : 'Your voting history, reviews, timestamps, and interaction frequency with local businesses.'}
                        </li>
                        <li>
                            <strong className="text-slate-900">{isAr ? 'معلومات الجهاز: ' : 'Device Information: '}</strong>
                            {isAr
                                ? 'البيانات التشخيصية القياسية المطلوبة لعمل التطبيق ومراقبة الأمان.'
                                : 'Standard diagnostic data required for app functionality and security monitoring.'}
                        </li>
                    </ul>
                </div>

                {/* 3. Purpose of Data Processing Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-blue-600 mb-4">
                        {isAr ? '3. الغرض من معالجة البيانات' : '3. Purpose of Data Processing'}
                    </h2>
                    <p className="text-gray-700 leading-relaxed">
                        {isAr
                            ? 'تُستخدم بياناتك حصرياً لتقديم وتأمين خدمات منصة تقدير. نستخدم رقم هاتفك للتحقق من هويتك ومنع الحسابات الاحتيالية. تتم معالجة سجل تصويتاتك بواسطة خوارزميات محرك الثقة لحساب "نقاط قَدِّر" الخاصة بك، وتحديد مستوى حسابك، وتطبيق فترات التبريد (24 ساعة) لمنع التلاعب بالتقييمات.'
                            : 'Your data is utilized exclusively to provide and secure the Tagdeer service. We use your phone number to verify your identity and prevent fraudulent accounts. Your voting history is processed by our Trust Engine algorithms to calculate your "Gader Points," determine your VIP Tier, and apply the 24-hour cooldown periods to prevent review manipulation.'}
                    </p>
                </div>

                {/* 4. Data Sharing & Third-Party Processors Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-blue-600 mb-4">
                        {isAr ? '4. مشاركة البيانات ومعالجات الأطراف الثالثة' : '4. Data Sharing & Third-Party Processors'}
                    </h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        {isAr
                            ? 'نحن لا نبيع بياناتك الشخصية. نشارك فقط الحد الأدنى من المعلومات الضرورية مع شركاء بنية تحتية موثوقين ومعتمدين لتشغيل منصتنا:'
                            : 'We do not sell your personal data. We only share minimal necessary information with fully vetted, enterprise-grade infrastructure partners to operate our platform:'}
                    </p>
                    <ul className="list-disc list-inside space-y-3 text-gray-700 leading-relaxed">
                        <li>
                            <strong className="text-slate-900">Supabase: </strong>
                            {isAr
                                ? 'لاستضافة قاعدة البيانات المشفرة والآمنة ومصادقة المستخدمين.'
                                : 'For secure, encrypted database hosting and user authentication.'}
                        </li>
                        <li>
                            <strong className="text-slate-900">Meta / Twilio: </strong>
                            {isAr
                                ? 'حصرياً لتوجيه وتسليم رموز التحقق الخاصة بك عبر واتساب.'
                                : 'Exclusively for routing and delivering your WhatsApp verification codes.'}
                        </li>
                    </ul>
                </div>

                {/* 5. Account Termination & Data Deletion Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-blue-600 mb-4">
                        {isAr ? '5. إنهاء الحساب وحذف البيانات' : '5. Account Termination & Data Deletion'}
                    </h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        {isAr
                            ? 'أنت تحتفظ بملكية بياناتك بالكامل. يمكنك إنهاء حسابك وطلب حذف بياناتك نهائياً في أي وقت.'
                            : 'You retain full ownership of your data. You may terminate your account and request permanent data deletion at any time.'}
                    </p>
                    <ul className="list-disc list-inside space-y-3 text-gray-700 leading-relaxed">
                        <li>
                            <strong className="text-slate-900">{isAr ? 'كيفية الحذف: ' : 'How to delete: '}</strong>
                            {isAr
                                ? <>انتقل إلى إعدادات ملفك الشخصي وحدد "حذف الحساب"، أو أرسل طلباً رسمياً للحذف إلى <a href="mailto:support@tagdeer.app" className="text-blue-600 hover:text-blue-800 underline underline-offset-2">support@tagdeer.app</a>.</>
                                : <>Navigate to your Profile Settings and select "Delete Account," or submit a formal deletion request to <a href="mailto:support@tagdeer.app" className="text-blue-600 hover:text-blue-800 underline underline-offset-2">support@tagdeer.app</a>.</>}
                        </li>
                        <li>
                            <strong className="text-slate-900">{isAr ? 'النتائج: ' : 'Consequences: '}</strong>
                            {isAr
                                ? 'عند الإنهاء، سيتم مسح رقم هاتفك وتفاصيل ملفك الشخصي وتأثير تصويتاتك النشطة نهائياً من قواعد بياناتنا.'
                                : 'Upon termination, your phone number, profile details, and active voting impact are permanently purged from our active databases.'}
                        </li>
                    </ul>
                </div>

            </div>
        </div>
    );
}
