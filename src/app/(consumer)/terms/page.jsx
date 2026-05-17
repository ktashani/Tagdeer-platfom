'use client';

import React from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { ShieldCheck, Scale, Users, FileText, Eye, BarChart3, Trash2 } from 'lucide-react';

export default function TermsPage() {
    const { lang, isRTL } = useTagdeer();
    const isAr = lang === 'ar';

    const sections = [
        {
            icon: ShieldCheck,
            color: 'blue',
            titleAr: '1. صفة المنصة الوسيطة',
            titleEn: '1. Intermediary Platform Status',
            contentAr: 'تقدير هي منصة تقنية وسيطة توفر البنية التحتية للملاحظات المجتمعية. لا تقوم تقدير بإنشاء أو طلب أو تحرير أو تأييد أو التحقق من أو تحمل المسؤولية التحريرية عن أي محتوى أنشأه المستخدمون، بما في ذلك التصويتات والمراجعات والتقييمات أو النصوص المقدمة. تعمل تقدير كمنصة محايدة تستضيف آراء المستخدمين دون التدخل في محتواها.',
            contentEn: 'Tagdeer is an intermediary technology platform that provides infrastructure for community-generated feedback. Tagdeer does not create, solicit, edit, endorse, verify, or take editorial responsibility for any user-generated content including votes, reviews, ratings, or text submissions. Tagdeer operates as a neutral platform that hosts user opinions without intervening in their content.',
        },
        {
            icon: Scale,
            color: 'indigo',
            titleAr: '2. مسؤولية المستخدم عن المحتوى',
            titleEn: '2. User Responsibility for Content',
            contentAr: 'كل مستخدم — سواء كان موثقاً أو مجهولاً — يتحمل المسؤولية الكاملة والحصرية عن المحتوى الذي يقدمه. بتقديم أي محتوى، يقر المستخدم بأن ما يقدمه يعبر عن رأيه الشخصي الصادق المبني على تجربة حقيقية، وأنه يقبل المسؤولية القانونية الكاملة عن كلماته. يوافق المستخدم على عدم نشر محتوى تشهيري أو كاذب أو مسيء أو يحرض على العنف أو الكراهية.',
            contentEn: 'Each user — whether verified or anonymous — is solely and exclusively responsible for the content they submit. By submitting any content, the user represents that their submission is their honest personal opinion based on genuine experience, and that they accept full legal liability for their words. The user agrees not to post content that is defamatory, false, abusive, or incites violence or hatred.',
        },
        {
            icon: Users,
            color: 'emerald',
            titleAr: '3. الدليل المجتمعي للأنشطة التجارية',
            titleEn: '3. Community Business Directory',
            contentAr: 'قد يتم إنشاء قوائم الأنشطة التجارية على تقدير من قبل أعضاء المجتمع كجزء من دليل للمصلحة العامة. ظهور اسم نشاط تجاري على تقدير لا يعني التأييد أو الشراكة أو العلاقة التجارية. يمكن لأصحاب الأنشطة التجارية المطالبة بقوائمهم والتحقق منها من خلال بوابة التاجر. إنشاء قائمة مجتمعية لا يمنح منشئها أي حق ملكية أو سيطرة على النشاط التجاري المُدرج.',
            contentEn: 'Business listings on Tagdeer may be created by community members as part of a public interest directory. The appearance of a business name on Tagdeer does not imply endorsement, partnership, or commercial relationship. Business owners may claim and verify their listings through the Merchant Portal. Creating a community listing does not grant the creator any ownership or control over the listed business.',
        },
        {
            icon: FileText,
            color: 'amber',
            titleAr: '4. بند الاستدعاء القضائي والإفصاح القانوني',
            titleEn: '4. Subpoena Clause & Legal Disclosure',
            contentAr: 'لا تخزن تقدير معلومات تعريف شخصية للمستخدمين المجهولين. البيانات الوصفية للنظام المجمعة لمنع الرسائل غير المرغوب فيها (معرفات الأجهزة المشفرة وبيانات الشبكة المشفرة) قد يتم تسليمها إذا طُلب ذلك قانونياً بموجب أمر محكمة صادر عن محكمة ليبية مختصة. يتم تخزين عناوين الشبكة بصيغة مشفرة أحادية الاتجاه (هاش) لا يمكن عكسها لتحديد هوية الأفراد.',
            contentEn: 'Tagdeer does not store personally identifiable information for anonymous users. System metadata collected for spam prevention purposes (hashed device identifiers, hashed network data) may be surrendered if legally compelled by a valid court order issued by a Libyan court of competent jurisdiction. Network addresses are stored as one-way cryptographic hashes that cannot be reversed to identify individuals.',
        },
        {
            icon: Eye,
            color: 'rose',
            titleAr: '5. إدارة المحتوى وحياد المنصة',
            titleEn: '5. Content Moderation & Platform Neutrality',
            contentAr: 'تستخدم تقدير فلاتر محتوى آلية ومراجعة بشرية لفرض معايير المجتمع. لن تقوم تقدير أبداً بتعديل محتوى المستخدم — يتم اتخاذ إجراءات ثنائية فقط: الإبقاء أو الإزالة. يتم تطبيق فلتر كلمات محظورة يشمل اللغة العربية والإنجليزية واللهجة الليبية لمنع المحتوى المسيء. المحتوى المزال قد يتم تعليمه أو إخفاؤه أو حذفه. هذه السياسة تحافظ على صفة تقدير كوسيط.',
            contentEn: 'Tagdeer employs automated content filters and human review to enforce community standards. Tagdeer will NEVER edit user content — only binary actions (keep/remove) are taken. A prohibited word filter covering Arabic, English, and Libyan dialect is enforced to prevent abusive content. Removed content may be flagged, hidden, or deleted. This policy preserves Tagdeer\'s intermediary status.',
        },
        {
            icon: BarChart3,
            color: 'violet',
            titleAr: '6. شفافية نظام الترجيح (مؤشر القدر)',
            titleEn: '6. Weighted Scoring Transparency (Gader Index)',
            contentAr: 'يستخدم مؤشر القدر خوارزمية ترجيح حيث يحمل المستخدمون الموثقون تأثيراً أعلى بكثير من المستخدمين المجهولين. تصويتات المستخدمين المجهولين لها وزن تأثير جزئي (حالياً 50% من الوزن الأساسي). هذا النظام مصمم لتقليل تأثير المساهمات غير الموثقة وتعزيز جودة التقييمات المجتمعية.',
            contentEn: 'The Gader Index uses a weighted algorithm where verified users carry significantly higher impact than anonymous users. Anonymous votes have a fractional impact weight (currently 50% of base weight). This system is designed to reduce the influence of unverified submissions and enhance the quality of community evaluations.',
        },
        {
            icon: Trash2,
            color: 'slate',
            titleAr: '7. طلب إزالة النشاط التجاري',
            titleEn: '7. Business Listing Removal Request',
            contentAr: 'يحق لأصحاب الأنشطة التجارية الموثقين طلب إزالة قائمة نشاطهم التجاري من المنصة. يتم ذلك عبر: (أ) المطالبة بالنشاط التجاري عبر بوابة التاجر مع تقديم وثائق الملكية، (ب) تقديم طلب إزالة رسمي إلى support@tagdeer.app مع إثبات الملكية. سيتم مراجعة الطلب خلال 7 أيام عمل. عند الإزالة، يتم حذف القائمة وجميع التقييمات المرتبطة بها نهائياً. لا يمكن إزالة القوائم المُطالب بها والنشطة إلا من قبل المالك الموثق.',
            contentEn: 'Verified business owners have the right to request removal of their business listing from the platform. This is done by: (a) claiming the business through the Merchant Portal with ownership documentation, (b) submitting a formal removal request to support@tagdeer.app with proof of ownership. Requests will be reviewed within 7 business days. Upon removal, the listing and all associated reviews are permanently deleted. Only verified owners can request removal of claimed, active listings.',
        },
    ];

    const colorMap = {
        blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-100', heading: 'text-blue-700' },
        indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-100', heading: 'text-indigo-700' },
        emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-100', heading: 'text-emerald-700' },
        amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-100', heading: 'text-amber-700' },
        rose: { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-100', heading: 'text-rose-700' },
        violet: { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-100', heading: 'text-violet-700' },
        slate: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-100', heading: 'text-slate-700' },
    };

    return (
        <div className="bg-gray-50 min-h-screen py-12" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="max-w-4xl mx-auto px-4 sm:px-6">

                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold mb-4 shadow-lg">
                        <Scale className="w-4 h-4" />
                        {isAr ? 'وثيقة قانونية' : 'Legal Document'}
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3">
                        {isAr ? 'شروط الاستخدام' : 'Terms of Service'}
                    </h1>
                    <p className="text-gray-500 font-medium">
                        {isAr ? 'تاريخ السريان: 17 مايو 2026 — الإصدار 1.0' : 'Effective Date: May 17, 2026 — Version 1.0'}
                    </p>
                </div>

                {/* Intro Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
                    <p className="text-gray-700 leading-relaxed">
                        {isAr
                            ? 'باستخدامك لمنصة تقدير (tagdeer.app)، فإنك توافق على الالتزام بهذه الشروط والأحكام. يُرجى قراءتها بعناية قبل استخدام المنصة أو تقديم أي محتوى. إذا كنت لا توافق على هذه الشروط، يُرجى عدم استخدام المنصة.'
                            : 'By using Tagdeer (tagdeer.app), you agree to be bound by these Terms and Conditions. Please read them carefully before using the platform or submitting any content. If you do not agree to these terms, please do not use the platform.'}
                    </p>
                </div>

                {/* Sections */}
                {sections.map((section, i) => {
                    const colors = colorMap[section.color];
                    const Icon = section.icon;
                    return (
                        <div key={i} className={`bg-white p-6 rounded-xl shadow-sm mb-6 border ${colors.border}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 ${colors.bg} ${colors.text} rounded-xl flex items-center justify-center`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <h2 className={`text-xl font-bold ${colors.heading}`}>
                                    {isAr ? section.titleAr : section.titleEn}
                                </h2>
                            </div>
                            <p className="text-gray-700 leading-relaxed">
                                {isAr ? section.contentAr : section.contentEn}
                            </p>
                        </div>
                    );
                })}

                {/* Contact */}
                <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg mt-8">
                    <h3 className="font-bold text-lg mb-2">
                        {isAr ? 'تواصل معنا' : 'Contact Us'}
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                        {isAr
                            ? 'لأي أسئلة حول هذه الشروط أو لتقديم طلب إزالة نشاط تجاري، يُرجى التواصل معنا عبر:'
                            : 'For any questions about these terms or to submit a business removal request, please contact us at:'}
                    </p>
                    <a href="mailto:support@tagdeer.app" className="inline-block mt-3 text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                        support@tagdeer.app
                    </a>
                </div>
            </div>
        </div>
    );
}
