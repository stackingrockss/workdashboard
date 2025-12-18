import { ContentType } from "@/types/content";

export interface VerifiableContentItem {
  title: string;
  url: string;
  description?: string;
  contentType: ContentType;
}

export const VERIFIABLE_CONTENT: VerifiableContentItem[] = [
  // === FOLDERS & MAIN RESOURCES ===
  {
    title: "SFDC + Verifiable Customer Story Engagements",
    url: "https://docs.google.com/presentation/d/1Jd2d0OtLgaX65AbVSCZo9DZ_mb7mrhYItWjfq_cgoDo/edit?usp=sharing",
    description: "Customer story engagements for Salesforce integration",
    contentType: "other",
  },
  {
    title: "Content Folder",
    url: "https://drive.google.com/drive/u/0/folders/1iMaFKU9oSwpMCrvl1aT57ho0BcfQo-bn",
    description: "Main folder containing all Verifiable content resources",
    contentType: "other",
  },

  // === EMAIL TEMPLATES ===
  {
    title: "Past CBC Email Templates",
    url: "https://docs.google.com/document/d/1s2vLvyQGrW5mu55JxhiS50gBIkbYusfU4YejRLiA5vg/edit?usp=sharing",
    description: "Collection of past CBC email templates for reference",
    contentType: "other",
  },

  // === OVERVIEWS & ONE-PAGERS ===
  {
    title: "General Verifiable Overview",
    url: "https://drive.google.com/file/d/1NxVicg_gvVPqSZFs2eO_diC1DZaVEwxY/view?usp=drive_link",
    description: "High-level overview of Verifiable platform and capabilities",
    contentType: "whitepaper",
  },
  {
    title: "Verifiable for Payers",
    url: "https://drive.google.com/file/d/1NCkEDeIG0-ht3SZ1iUMQYKKO6sGN_sAI/view?usp=drive_link",
    description: "Verifiable solutions tailored for payer organizations",
    contentType: "whitepaper",
  },
  {
    title: "Verifiable Ongoing Monitoring",
    url: "https://drive.google.com/file/d/1XZgtJ42BFUzpHWIcTK3E-HyjBsduiULQ/view?usp=drive_link",
    description: "Overview of ongoing provider monitoring capabilities",
    contentType: "whitepaper",
  },
  {
    title: "Verifiable Verification Engine",
    url: "https://drive.google.com/file/d/18Xd1dh4aJk6RV6uoehSskMa1d4bqBFd-/view?usp=drive_link",
    description: "Technical overview of the verification engine",
    contentType: "whitepaper",
  },
  {
    title: "Delegated Credentialing One Pager",
    url: "https://9152345.fs1.hubspotusercontent-na1.net/hubfs/9152345/One-pagers/Delegated%20Credentialing%20With%20Verifiable_One%20Pager_2024.pdf",
    description: "Build your credentialing program for efficiency and accuracy",
    contentType: "whitepaper",
  },
  {
    title: "Verifiable for Providers One Pager",
    url: "https://9152345.fs1.hubspotusercontent-na1.net/hubfs/9152345/One-pagers/Verifiable%20for%20Providers_One%20Pager_2024.pdf",
    description: "Seamless credentialing & network monitoring to optimize network operations",
    contentType: "whitepaper",
  },

  // === GUIDES ===
  {
    title: "Buyer's Guide: Credentialing and Network Monitoring Software",
    url: "https://verifiable.com/resources/buyers-guide-credentialing-network-monitoring",
    description: "Comprehensive buyer's guide for credentialing software evaluation",
    contentType: "whitepaper",
  },
  {
    title: "Guide to Provider Network Monitoring",
    url: "https://verifiable.com/guides/guide-to-provider-network-monitoring-for-payers-providers-and-beyond",
    description: "Complete guide to provider network monitoring for payers, providers, and beyond",
    contentType: "whitepaper",
  },
  {
    title: "Guide to Insourcing Credentialing",
    url: "https://drive.google.com/file/d/1AUuNe4-Q8XZC71QCnOzwnrsGRnhYot4V/view?usp=drive_link",
    description: "Guide for organizations considering insourcing their credentialing operations",
    contentType: "whitepaper",
  },
  {
    title: "The Delegated Credentialing Handbook",
    url: "https://drive.google.com/file/d/19lSe9EzyYbvEBWq-B5IBLmAuoS79yWIU/view?usp=drive_link",
    description: "Comprehensive handbook for delegated credentialing processes",
    contentType: "whitepaper",
  },
  {
    title: "Industry Leading PSVs",
    url: "https://drive.google.com/file/d/1D06dKWwt0QjtTmZgFBZxoSkrVmoPgGV0/view?usp=drive_link",
    description: "Overview of industry-leading primary source verifications",
    contentType: "whitepaper",
  },
  {
    title: "Provider Data Strategy Impact on Network Growth",
    url: "https://9152345.fs1.hubspotusercontent-na1.net/hubfs/9152345/Gated%20Downloads/The%20Influencing%20Factors%20of%20Provider%20Data%20Strategy%20on%20Provider%20Network%20Growth.pdf",
    description: "The influencing factors of provider data strategy on provider network growth",
    contentType: "whitepaper",
  },
  {
    title: "Provider Network Monitoring Guide",
    url: "https://verifiable.com/resources/network-monitoring-guide",
    description: "Comprehensive guide to provider network monitoring best practices",
    contentType: "whitepaper",
  },

  // === INTERNAL DOCS & STATS ===
  {
    title: "CSAT and NPS Score",
    url: "https://docs.google.com/document/d/1P1yjcqD94e0fWNaIqYcBcx3lsa0o8LdcRIgfiQtDAQI/edit?usp=sharing",
    description: "Customer satisfaction and NPS score documentation",
    contentType: "other",
  },
  {
    title: "How Verifiable Helps Meet NCQA Standards",
    url: "https://docs.google.com/document/d/1gI5Em8VtBF105knlr6l10vtASBLPEHDS9mpeonJQEzQ/edit?usp=sharing",
    description: "How Verifiable helps organizations modernize credentialing processes to meet NCQA standards",
    contentType: "other",
  },
  {
    title: "KPIs - Verification Speed",
    url: "https://docs.google.com/document/d/1NQur_qbDPjqc_B9-DZBAMXAMaZDYGymGgX5sSE-8_Ss/edit?usp=sharing",
    description: "KPIs on how fast Verifiable pulls verifications",
    contentType: "other",
  },
  {
    title: "Becker's Top 12 Healthcare Initiatives (Summer '24)",
    url: "https://docs.google.com/document/d/1N1Gp8S29YZ_nraZAR5Fx9qzUXJ_X4uxPOddbh8TdWzM/edit?usp=sharing",
    description: "Becker's top 12 healthcare initiatives from summer 2024",
    contentType: "other",
  },
  {
    title: "Academic Medical Center Top 10 Priorities",
    url: "https://docs.google.com/document/d/1IKlZhS5esvjpVpseQrpKt9KoWtXX_pBAnqsJfKI5IFs/edit?usp=sharing",
    description: "Top 10 priorities for academic medical centers",
    contentType: "other",
  },
  {
    title: "Financial Risk without Verifiable (EAP Email)",
    url: "https://docs.google.com/document/d/11h3q_ZVqR6PVPKShCrfLbnyIvyt9cEXU2vkjtF3F6Hc/edit?usp=sharing",
    description: "Email content highlighting financial risk without Verifiable - good for EAP outreach",
    contentType: "other",
  },
  {
    title: "90 Days NCQA Requirement (Jocelyn Follow-up)",
    url: "https://docs.google.com/document/d/1JutSOLM6l8-8xXLDEzzKBUd-Az1sqttRcU2Zhz5xG2Y/edit?usp=sharing",
    description: "Follow-up content on 90 days NCQA requirement",
    contentType: "other",
  },
  {
    title: "Ongoing Monitoring: $7.6M Centene Fine",
    url: "https://docs.google.com/document/d/1VK9Yc8ydvcgixFYKW635hyujA678vLxQsm5z4K6xSH0/edit?usp=sharing",
    description: "The importance of ongoing monitoring - $7.6M Centene fine for convicted provider",
    contentType: "other",
  },
  {
    title: "SSDMF Laws in 2028",
    url: "https://docs.google.com/document/d/1EA5vASTME4Ue7uDC5WsWMgBwhwFFRzto0iWhKBnJefM/edit?usp=sharing",
    description: "Information about SSDMF laws coming in 2028",
    contentType: "other",
  },
  {
    title: "Verifiable Inc. 5000 #27",
    url: "https://docs.google.com/document/d/1szaPtyTyTKsKpaiJrvptZaOqSYPq5qtGGTEOzGj6zo4/edit?usp=sharing",
    description: "Verifiable's Inc. 5000 ranking at #27",
    contentType: "other",
  },
  {
    title: "NCQA Report Card & Quarterly Stats Email Template",
    url: "https://docs.google.com/document/d/1PXIQdk3duKNFZozxD-MdHIrvetDb3SzblLM1HyiR_fE/edit?usp=sharing",
    description: "Email template for sharing NCQA report card and quarterly stats",
    contentType: "other",
  },
  {
    title: "June 2025 Quarterly Results - Turnaround Times",
    url: "https://docs.google.com/document/d/1R_nW92b77lvVpsm12xwGi1AL8T3zm0j4YBPaU-vqKtg/edit?usp=sharing",
    description: "Quarterly results showing turnaround times for June 2025",
    contentType: "other",
  },
  {
    title: "NCQA Network Monitoring Update",
    url: "https://docs.google.com/document/d/1XYUdakDg0TLnrPTk0IaP93FW8lMzUH6zmCYoNrXu6ik/edit?tab=t.0",
    description: "Latest updates on NCQA network monitoring requirements",
    contentType: "other",
  },

  // === WEBINARS ===
  {
    title: "AI Webinar for Health Plans",
    url: "https://www.brightspotsinhealthcare.com/events/inside-credentialing-where-ai-delivers-measurable-roi-for-health-plans/",
    description: "Inside Credentialing: Where AI Delivers Measurable ROI for Health Plans",
    contentType: "webinar",
  },

  // === BLOG POSTS ===
  {
    title: "How to Boost Credentialing Team Satisfaction",
    url: "https://verifiable.com/blog/how-to-boost-credentialing-team-satisfaction-while-accelerating-turnaround-times",
    description: "Tips for boosting credentialing team satisfaction while accelerating turnaround times",
    contentType: "blog_post",
  },
  {
    title: "Get Ahead of 2025 NCQA Credentialing Changes",
    url: "https://verifiable.com/blog/get-ahead-of-the-2025-changes-to-ncqa-credentialing-guidelines",
    description: "Prepare for the 2025 changes to NCQA credentialing guidelines",
    contentType: "blog_post",
  },
  {
    title: "The Costs of Inefficient Credentialing",
    url: "https://verifiable.com/blog/from-risk-to-trust-tackling-inefficient-provider-verifications-in-2024-and-beyond",
    description: "The costs of inefficient credentialing are bigger than you think",
    contentType: "blog_post",
  },
  {
    title: "3 Questions for Credentialing Team Growth Prep",
    url: "https://verifiable.com/blog/3-questions-to-ask-your-credentialing-operations-team-when-preparing-for-provider-network-growth",
    description: "3 questions to ask your credentialing team when preparing for growth",
    contentType: "blog_post",
  },
  {
    title: "4 Ways to Improve Provider Network Visibility",
    url: "https://verifiable.com/blog/4-ways-to-unblock-your-path-to-clear-provider-network-visibility",
    description: "4 ways to unblock your path to clear provider network visibility",
    contentType: "blog_post",
  },
  {
    title: "Generate Provider Rosters in Minutes with Salesforce",
    url: "https://verifiable.com/blog/generate-provider-rosters-in-minutes--with-verifiable-on-salesforce",
    description: "Simplify and generate rosters for enrollment within minutes using Verifiable on Salesforce",
    contentType: "blog_post",
  },
  {
    title: "Facility Credentialing: One Solution for All Providers",
    url: "https://verifiable.com/blog/facility-credentialing-one-solution-for-credentialing-all-providers",
    description: "Looking for facility credentialing? One solution for credentialing all providers",
    contentType: "blog_post",
  },
  {
    title: "3 Ways Health Plans Can Optimize Networks",
    url: "https://verifiable.com/blog/3-ways-health-plans-can-optimize-networks-with-verifiable",
    description: "3 ways health plans can optimize their networks with Verifiable",
    contentType: "blog_post",
  },
  {
    title: "Maintain High-Quality Provider Network with Proactive Monitoring",
    url: "https://verifiable.com/blog/how-payers-maintain-a-high-quality-provider-network-with-proactive-monitoring",
    description: "How payers maintain a high-quality provider network with proactive monitoring",
    contentType: "blog_post",
  },
  {
    title: "ROI of Provider Data Transparency",
    url: "https://verifiable.com/blog/roi-of-provider-data-transparency-in-healthcare-organizations",
    description: "What's the ROI of provider data transparency in healthcare organizations?",
    contentType: "blog_post",
  },
  {
    title: "Faster Credentialing = Better Provider Experience",
    url: "https://verifiable.com/blog/faster-medical-credentialing-better-provider-experiences-network-growth",
    description: "Faster credentialing leads to improved provider experience and network growth",
    contentType: "blog_post",
  },
  {
    title: "4 Reasons Why Ongoing Monitoring Matters",
    url: "https://verifiable.com/blog/4-reasons-why-ongoing-provider-network-monitoring-matters",
    description: "4 reasons why ongoing provider network monitoring matters",
    contentType: "blog_post",
  },
  {
    title: "When to Drop Your CVO for In-house Credentialing",
    url: "https://verifiable.com/blog/when-to-drop-your-cvo-for-inhouse-enrollment-credentialing",
    description: "When to drop your CVO for in-house enrollment & credentialing",
    contentType: "blog_post",
  },
  {
    title: "Tips for Improved Medical Credentialing Process",
    url: "https://verifiable.com/blog/tips-for-an-improved-medical-credentialing-process",
    description: "Tips for an improved medical credentialing process",
    contentType: "blog_post",
  },
  {
    title: "NCQA Primary Source Verification Requirements",
    url: "https://verifiable.com/blog/ncqa-primary-source-verification-requirements",
    description: "What are the NCQA primary source verification requirements?",
    contentType: "blog_post",
  },

  // === CASE STUDIES ===
  {
    title: "Customer Stories Library",
    url: "https://docs.google.com/presentation/d/1nJhLnzdnpmjCYgrarQxSjW-9y6_utuHntIA5pn9QgkY/edit?usp=sharing",
    description: "Presentation library of customer success stories",
    contentType: "case_study",
  },
  {
    title: "Customer Stories List",
    url: "https://docs.google.com/document/d/1D6JM3mKNR6QIUZnuvkED8oZH9oE-cYdB7sSe8YFj5i0/edit?usp=sharing",
    description: "Comprehensive list of customer stories and references",
    contentType: "case_study",
  },
  {
    title: "Humana Case Study",
    url: "https://drive.google.com/file/d/1wskuw94vfuhLfNAzUpHMsMpzOie8glwm/view?usp=drive_link",
    description: "Humana's success story with Verifiable",
    contentType: "case_study",
  },
  {
    title: "Excellus BCBS Case Study",
    url: "https://drive.google.com/file/d/1UCC6Wm2TXVlTdCLb6RTIKqpZKqZSvv1C/view?usp=drive_link",
    description: "Excellus BCBS - Replacing Cactus, NCQA compliance, accelerating credentialing",
    contentType: "case_study",
  },
  {
    title: "Grow Therapy Case Study",
    url: "https://drive.google.com/file/d/1y6wwnvhBJZNEqHqwZ4588T_jxep5-CSB/view?usp=drive_link",
    description: "Grow Therapy seeking delegation with Verifiable",
    contentType: "case_study",
  },
  {
    title: "Grow Therapy LinkedIn Social Proof",
    url: "https://www.linkedin.com/posts/cynthiagrant_grow-therapy-on-verifiable-activity-7191651243025485825-vJeC",
    description: "Unsolicited feedback and social proof from Grow Therapy on LinkedIn",
    contentType: "case_study",
  },
  {
    title: "Grow Therapy Slide",
    url: "https://docs.google.com/presentation/d/1wiRHaJDKc1USM40fz4nQS51fFvgnk-0wU-M-hgkmr3Y/edit#slide=id.g2f8746bf56b_2_9",
    description: "One-slide overview of Grow Therapy case study (slide 17)",
    contentType: "case_study",
  },
  {
    title: "Modern Health - Improved Provider Experience",
    url: "https://verifiable.com/resources/case-studies/modern-health",
    description: "How Modern Health improved provider experience with Verifiable",
    contentType: "case_study",
  },
  {
    title: "Spring Health Case Study",
    url: "https://drive.google.com/file/d/12Udw0JI88SxL_ZXKrabX3C1MksXO1r6q/view?usp=drive_link",
    description: "Spring Health: Seeking delegation, NCQA accreditation, automatic PSVs and monitoring, grew network 2x",
    contentType: "case_study",
  },
  {
    title: "Empower Pharmacy Case Study",
    url: "https://9152345.fs1.hubspotusercontent-na1.net/hubfs/9152345/Case%20Studies/Verifiable%2B-%2BEmpower%2BPharmacy%2BCase%2BStudy.pdf",
    description: "Empower Pharmacy's success story with Verifiable",
    contentType: "case_study",
  },
  {
    title: "Roster Gen Changed My Life!",
    url: "https://docs.google.com/document/d/1uCMt89UKDI1y6yM9q5YT9_LBaxxvvixPsGwaNc7EsB0/edit?usp=sharing",
    description: "Customer testimonial about roster generation feature impact",
    contentType: "case_study",
  },
  {
    title: "2024 AppExchange 5-Star Review",
    url: "https://docs.google.com/document/d/1O3tDQLgpSc8QDZ7aTt689csPdNDtWxGwdqwbSsMJCRQ/edit?usp=sharing",
    description: "5-star review from 2024 AppExchange",
    contentType: "case_study",
  },
  {
    title: "TeleCare 3x Faster Provider Onboarding",
    url: "https://docs.google.com/document/d/1SOPs5K5oE8iW_oLZRLlKr8HcvjmUpev3wD2L6YOFyzs/edit?usp=sharing",
    description: "TeleCare achieved 3x faster provider onboarding with Verifiable",
    contentType: "case_study",
  },

  // === VIDEOS ===
  {
    title: "Community Health Alliance Nevada Video",
    url: "https://www.youtube.com/watch?v=8jgpgwbG3qU",
    description: "Video testimonial from Community Health Alliance Nevada",
    contentType: "video",
  },
];
