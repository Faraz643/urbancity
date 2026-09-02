import { Link, useLocation } from 'react-router-dom';

type PageKey = 'about'|'how-it-works'|'faq'|'rules'|'terms'|'privacy'|'refund-policy'|'contact'|'pricing';

const CONTENT: Record<PageKey,{title:string;lead:string;sections:{heading:string;body:string[]}[]}> = {
  about:{title:'About UrbanCity',lead:'UrbanCity is an interactive digital city where businesses can discover and book advertising spaces displayed inside a shared 3D environment.',sections:[
    {heading:'What UrbanCity does',body:['UrbanCity makes advertising inventory interactive. Businesses can explore available billboards, review the location and pricing, upload an advertisement, and book an available space for the selected duration.','When a booking is active, the advertiser’s approved creative can be displayed on the corresponding advertising space in UrbanCity.']},
    {heading:'Our purpose',body:['We aim to make digital advertising spaces easier to discover and understand by presenting them in an interactive city experience rather than only as a traditional list of placements.']}
  ]},
  'how-it-works':{title:'How It Works',lead:'Booking an advertising space in UrbanCity is designed to be straightforward.',sections:[
    {heading:'1. Explore',body:['Enter UrbanCity and move around the city to discover available advertising spaces.']},
    {heading:'2. Choose a space',body:['Interact with a billboard to review its information, traffic category, booking duration and price.']},
    {heading:'3. Add your creative',body:['Provide your company name and advertisement details. You may upload a supported image and optionally provide a destination link.']},
    {heading:'4. Pay and activate',body:['Complete payment through the available secure payment checkout. A booking becomes active only after payment is successfully confirmed and the applicable booking process is completed.']},
    {heading:'5. Manage your booking',body:['During an active booking, eligible account controls allow you to manage the creative associated with your booked advertising space.']}
  ]},
  faq:{title:'Frequently Asked Questions',lead:'Clear answers to common questions about UrbanCity.',sections:[
    {heading:'What is UrbanCity?',body:['UrbanCity is an interactive platform for discovering and booking digital advertising spaces in a shared 3D city environment.']},
    {heading:'Do I need an account?',body:['Yes. An account is required for actions that require identifying and managing a user, including booking or bidding features.']},
    {heading:'How is the price calculated?',body:['The booking panel shows the applicable price before checkout. Prices and duration options can vary by advertising space and package.']},
    {heading:'When does my booking start?',body:['A booking is not considered paid or confirmed merely because checkout was opened. Activation depends on successful payment confirmation and the platform booking process.']},
    {heading:'Can I change my advertisement?',body:['Where editing is available for an active booking, you can update eligible creative details through UrbanCity. Content remains subject to our Rules and applicable law.']},
    {heading:'Where can I ask for help?',body:['Use the Contact Us page to send us your enquiry.']}
  ]},
  rules:{title:'UrbanCity Rules',lead:'These rules help keep UrbanCity safe, useful and fair for everyone.',sections:[
    {heading:'Use the platform responsibly',body:['Do not interfere with the platform, attempt to gain unauthorized access, disrupt other users, or misuse accounts or payment systems.']},
    {heading:'Advertising content',body:['You are responsible for the content you submit and for having the rights and permissions needed to use it. Do not submit unlawful, deceptive, infringing, hateful, sexually explicit, malicious or otherwise prohibited content.','We may reject, remove or disable content that violates these Rules, our Terms, applicable law, or reasonable platform safety requirements.']},
    {heading:'Accurate information',body:['Keep your account and business information accurate. Do not impersonate another person or business.']},
    {heading:'Fair access',body:['Do not use bots or abusive automation to manipulate bookings, auctions, traffic measurements or other platform features unless we explicitly permit it.']},
    {heading:'Enforcement',body:['We may investigate violations and take appropriate action, including restricting content, cancelling access or suspending an account where permitted by our Terms and applicable law.']}
  ]},
  terms:{title:'Terms & Conditions',lead:'These Terms explain the basic conditions for using UrbanCity and booking advertising services through the platform.',sections:[
    {heading:'Acceptance of these Terms',body:['By accessing or using UrbanCity, you agree to these Terms and our Privacy Policy. If you do not agree, please do not use the service.']},
    {heading:'Accounts',body:['You are responsible for safeguarding your login credentials and for activity performed through your account. Provide accurate information and notify us if you believe your account has been accessed without permission.']},
    {heading:'Advertising bookings',body:['UrbanCity displays advertising inventory, availability, durations and prices through the platform. A booking request is subject to availability and successful payment confirmation. We may correct obvious pricing, technical or availability errors before activation where permitted by law.']},
    {heading:'Your content and rights',body:['You retain responsibility for the advertising content you provide. By submitting content for display, you give UrbanCity the limited permission necessary to store, process and display that content for operating your booking and the platform.']},
    {heading:'Prohibited use',body:['You must not use UrbanCity for unlawful activity, fraud, infringement, unauthorized access, malware distribution or any activity prohibited by our Rules.']},
    {heading:'Availability and changes',body:['We work to keep UrbanCity available, but uninterrupted or error-free operation cannot be guaranteed. Features may be updated, changed or discontinued as the platform evolves.']},
    {heading:'Limitation and contact',body:['Nothing in these Terms excludes rights that cannot legally be excluded. For questions about these Terms, please use our Contact Us page.']}
  ]},
  privacy:{title:'Privacy Policy',lead:'This policy explains, in plain language, how UrbanCity may handle personal information when you use the platform.',sections:[
    {heading:'Information we may collect',body:['This can include account information such as your name or display name, email address and information you submit for your advertising profile. We may also process technical information needed to operate and secure the service, such as device or log information.']},
    {heading:'How information is used',body:['We use information to provide accounts and platform features, process bookings, communicate about the service, prevent abuse and fraud, maintain security and comply with legal obligations.']},
    {heading:'Payments',body:['Payments are processed through third-party payment providers. UrbanCity does not intend to store full payment card details on its own servers when a provider-hosted checkout is used. The payment provider may process information according to its own privacy terms.']},
    {heading:'Advertising uploads',body:['Creative files and related information may be stored with our infrastructure providers so they can be displayed and managed through UrbanCity.']},
    {heading:'Sharing and service providers',body:['We may use trusted service providers for hosting, storage, databases, payments and other functions required to operate UrbanCity. We share information only as reasonably necessary for those services, legal requirements or protection of the platform and users.']},
    {heading:'Your choices',body:['Depending on applicable law, you may have rights to request access, correction, deletion or other information about your personal data. Contact us to make a request.']},
    {heading:'Updates',body:['We may update this policy as UrbanCity develops. The current version published on this page applies from the time it is posted.']}
  ]},
  'refund-policy':{title:'Refund & Cancellation Policy',lead:'Please read this policy before making a booking.',sections:[
    {heading:'Before you pay',body:['The booking panel shows the selected advertising space, duration and price before checkout. Please review these details carefully before completing payment.']},
    {heading:'Cancellation before activation',body:['If you need to cancel a booking request before it has been activated, contact us promptly with the booking details. We will review the request based on the booking status and applicable law.']},
    {heading:'Active bookings',body:['Advertising time is a time-based digital service. Once an advertising booking has started or the reserved advertising time has been delivered, a full refund may not be available simply because unused time remains.']},
    {heading:'Service problems',body:['If there is a significant technical problem attributable to UrbanCity that materially prevents delivery of a confirmed booking, contact us with the booking details. We will investigate and, where appropriate and required, consider a remedy such as restoration of service, rescheduling, credit or refund.']},
    {heading:'How to request help',body:['Use Contact Us and include the account email, booking or payment reference, date, and a clear description of the issue. This policy does not limit any mandatory consumer rights that apply to you.']}
  ]},
  contact:{title:'Contact Us',lead:'Need help with UrbanCity, a booking or a policy question? We are happy to hear from you.',sections:[
    {heading:'Support enquiries',body:['Please contact us through the official support contact configured for UrbanCity and include enough detail for us to understand your request.']},
    {heading:'Booking and payment enquiries',body:['Include your account email, booking or payment reference, date and a short description of the problem. Do not send passwords or full card details.']},
    {heading:'Important',body:['UrbanCity should publish a monitored business support email address and, where required by the business jurisdiction or payment provider, additional business contact details. These details should be added before production payment onboarding.']}
  ]},
  pricing:{title:'Pricing',lead:'UrbanCity shows the applicable price before you proceed to payment.',sections:[
    {heading:'Advertising space pricing',body:['Pricing can vary by advertising space, duration and package. The current price for the selected booking is displayed inside the booking panel before checkout.']},
    {heading:'What you pay',body:['The checkout amount is based on the booking details presented to you before payment. Any taxes or other charges that are legally applicable will be handled as required and shown where applicable.']},
    {heading:'Changes',body:['Future prices or packages may change. A change does not alter a booking that has already been successfully confirmed unless required to correct a clear error or permitted by applicable law.']}
  ]}
};

const LINKS:[PageKey,string][]=[['about','About'],['how-it-works','How It Works'],['faq','FAQ'],['rules','Rules'],['pricing','Pricing'],['terms','Terms & Conditions'],['privacy','Privacy Policy'],['refund-policy','Refund & Cancellation'],['contact','Contact Us']];

export default function PublicPage({page}:{page:PageKey}) {
  const location=useLocation(), data=CONTENT[page];
  return <main className="public-page">
    <nav className="public-nav"><Link to="/" className="public-brand">URBANCITY</Link><Link to="/" className="back-to-city">← Back to City</Link></nav>
    <article className="public-article">
      <div className="public-kicker">URBANCITY • {page.replaceAll('-',' ').toUpperCase()}</div>
      <h1>{data.title}</h1><p className="public-lead">{data.lead}</p>
      <div className="public-divider"/>
      {data.sections.map(s=><section key={s.heading}><h2>{s.heading}</h2>{s.body.map((p,i)=><p key={i}>{p}</p>)}</section>)}
      <p className="public-updated">Last updated: September 2026</p>
    </article>
    <footer className="public-footer">{LINKS.map(([key,label])=><Link key={key} to={'/'+key} className={location.pathname==='/'+key?'selected':''}>{label}</Link>)}</footer>
  </main>
}
