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
                        {isAr ? 'تاريخ السريان: 17 مايو 2026 — الإصدار 1.0' : 'Effective Date: May 17, 2026 — Version 1.0'}
                    </p>
                </div>

                {/* 1. Introduction */}
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

                {/* 2. Information We Collect */}
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

                {/* 3. Purpose of Data Processing */}
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

                {/* 4. Data Sharing */}
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
                        <li><strong className="text-slate-900">Supabase: </strong>{isAr ? 'لاستضافة قاعدة البيانات المشفرة والآمنة ومصادقة المستخدمين.' : 'For secure, encrypted database hosting and user authentication.'}</li>
                        <li><strong className="text-slate-900">Meta / Twilio: </strong>{isAr ? 'حصرياً لتوجيه وتسليم رموز التحقق الخاصة بك عبر واتساب.' : 'Exclusively for routing and delivering your WhatsApp verification codes.'}</li>
                    </ul>
                </div>

                {/* 5. Account Termination */}
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
                                ? <>انتقل إلى إعدادات ملفك الشخصي وحدد &quot;حذف الحساب&quot;، أو أرسل طلباً رسمياً للحذف إلى <a href="mailto:support@tagdeer.app" className="text-blue-600 hover:text-blue-800 underline underline-offset-2">support@tagdeer.app</a>.</>
                                : <>Navigate to your Profile Settings and select &quot;Delete Account,&quot; or submit a formal deletion request to <a href="mailto:support@tagdeer.app" className="text-blue-600 hover:text-blue-800 underline underline-offset-2">support@tagdeer.app</a>.</>}
                        </li>
                        <li>
                            <strong className="text-slate-900">{isAr ? 'النتائج: ' : 'Consequences: '}</strong>
                            {isAr
                                ? 'عند الإنهاء، سيتم مسح رقم هاتفك وتفاصيل ملفك الشخصي وتأثير تصويتاتك النشطة نهائياً من قواعد بياناتنا.'
                                : 'Upon termination, your phone number, profile details, and active voting impact are permanently purged from our active databases.'}
                        </li>
                    </ul>
                </div>

                {/* 6. Law Enforcement Disclosure */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-blue-600 mb-4">
                        {isAr ? '6. الإفصاح لجهات إنفاذ القانون' : '6. Law Enforcement Disclosure'}
                    </h2>
                    <p className="text-gray-700 leading-relaxed">
                        {isAr
                            ? 'قد تفصح تقدير عن البيانات الوصفية المشفرة (هاش) لجهات إنفاذ القانون إذا أُلزمت بذلك بموجب أمر قضائي صادر من محكمة ليبية مختصة. لا تفصح تقدير طوعياً عن معلومات المستخدمين. نظراً لأن عناوين الشبكة تُخزن بصيغة هاش مشفرة أحادية الاتجاه، فلا يمكن عكسها لتحديد هوية المستخدمين الأفراد.'
                            : 'Tagdeer may disclose hashed metadata to law enforcement agencies if compelled by a valid court order issued by a Libyan court of competent jurisdiction. Tagdeer does not voluntarily disclose user information. Because network addresses are stored as one-way cryptographic hashes, they cannot be reversed to identify individual users.'}
                    </p>
                </div>

                {/* 7. Anonymous User Data */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-blue-600 mb-4">
                        {isAr ? '7. بيانات المستخدمين المجهولين والاحتفاظ بها' : '7. Anonymous User Data & Retention'}
                    </h2>
                    <p className="text-gray-700 leading-relaxed">
                        {isAr
                            ? 'للمستخدمين الذين لا ينشئون حساباً، تجمع تقدير بصمات أجهزة مشفرة (هاش) ومعرفات شبكة مشفرة (هاش) حصرياً لمنع الرسائل غير المرغوب فيها وحماية نزاهة نظام التقييم. يتم حذف هذه المعرفات تلقائياً بعد 90 يوماً. لا تُستخدم هذه البيانات لأي غرض تجاري أو إعلاني.'
                            : 'For users who do not create an account, Tagdeer collects hashed device fingerprints and hashed network identifiers solely for spam prevention and protecting the integrity of the review system. These identifiers are automatically purged after 90 days. This data is not used for any commercial or advertising purpose.'}
                    </p>
                </div>

                {/* 8. Device Fingerprinting */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-blue-600 mb-4">
                        {isAr ? '8. بصمة الجهاز' : '8. Device Fingerprinting'}
                    </h2>
                    <p className="text-gray-700 leading-relaxed">
                        {isAr
                            ? 'تستخدم تقدير خصائص عرض الرسومات (Canvas)، ومواصفات الأجهزة، وإعدادات المتصفح لإنشاء بصمة جهاز فريدة. تُستخدم هذه البصمة حصرياً لتحديد عدد التفاعلات المجهولة من نفس الجهاز ومنع إساءة الاستخدام. لا ترتبط هذه البصمة بالهوية الشخصية ولا يمكن استخدامها لتتبع المستخدم عبر مواقع أخرى.'
                            : 'Tagdeer uses canvas rendering characteristics, hardware specifications, and browser configuration to generate a unique device fingerprint. This fingerprint is used exclusively to limit anonymous interactions from the same device and prevent abuse. This fingerprint is not linked to personal identity and cannot be used to track users across other websites.'}
                    </p>
                </div>

                {/* Contact */}
                <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg mt-8">
                    <h3 className="font-bold text-lg mb-2">
                        {isAr ? 'تواصل معنا' : 'Contact Us'}
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                        {isAr
                            ? 'لأي أسئلة حول سياسة الخصوصية هذه، يُرجى التواصل معنا عبر:'
                            : 'For any questions about this privacy policy, please contact us at:'}
                    </p>
                    <a href="mailto:support@tagdeer.app" className="inline-block mt-3 text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                        support@tagdeer.app
                    </a>
                </div>

            </div>
        </div>
    );
}
