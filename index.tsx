import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';

// Fix: Add a global declaration for `window.html2canvas` and `window.jspdf` to resolve TypeScript errors.
declare global {
  interface Window {
    html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
    jspdf: any;
  }
}

// Helper to call our proxy
const callApi = async (body: any) => {
    const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error("API Error:", errorBody);
        throw new Error(`API request failed with status ${response.status}`);
    }

    return response.json();
};


// --- Main App Component ---
const App = () => {
  const [activePage, setActivePage] = useState('chat');
  const [showMotivationalModal, setShowMotivationalModal] = useState(false);
  const [motivationalMessage, setMotivationalMessage] = useState('');
  const [apiReady, setApiReady] = useState(true); // Assume ready, update on error

  useEffect(() => {
    const visitCountStr = localStorage.getItem('appVisitCount') || '0';
    let visitCount = parseInt(visitCountStr, 10) + 1;

    if (visitCount === 1 || visitCount % 15 === 0) {
      setShowMotivationalModal(true);
      const fetchMotivationalMessage = async () => {
        try {
          const prompt = "اكتب رسالة تحفيزية قصيرة وملهمة، لا تتجاوز ثلاث جمل، لطالب سوري يدرس في ظل الظروف الصعبة. يجب أن تكون الرسالة مشجعة وتركز على قوة الإرادة وأهمية العلم لمستقبل سوريا.";
          const response = await callApi({
              model: 'google/gemini-flash-1.5',
              contents: [{ parts: [{ text: prompt }] }],
          });
          setMotivationalMessage(response.text);
        } catch (error) {
          console.error("Failed to fetch motivational message:", error);
          setApiReady(false);
          setMotivationalMessage("كل صفحة تقرأها اليوم هي خطوة تبني بها غداً مشرقاً لك ولوطنك.");
        }
      };
      fetchMotivationalMessage();
    }

    localStorage.setItem('appVisitCount', visitCount.toString());
  }, []);

  const renderPage = () => {
    if (!apiReady) {
        return <div className="page"><div className="header"><h1>خطأ</h1></div><div className="error-message">لم يتمكن التطبيق من الاتصال بالخادم. قد يكون مفتاح API غير صحيح أو مفقود في إعدادات Netlify.</div></div>;
    }
    switch (activePage) {
      case 'chat':
        return <ChatPage />;
      case 'books':
        return <BooksPage />;
      case 'summarizer':
        return <SummarizerPage />;
      case 'quiz':
        return <QuizBuilderPage />;
      case 'iq':
        return <IQTestPage />;
      case 'updates':
        return <UpdatesPage />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <div className="app-container">
      {showMotivationalModal && (
        <MotivationalModal 
          message={motivationalMessage} 
          onClose={() => setShowMotivationalModal(false)} 
        />
      )}
      <div className="top-bar"></div>
      <main className="content-container">
        {renderPage()}
      </main>
      <BottomNav activePage={activePage} setActivePage={setActivePage} />
    </div>
  );
};

// --- Motivational Modal Component ---
const MotivationalModal = ({ message, onClose }) => {
    const isLoading = !message;
    return (
        <div className="motivational-modal-overlay">
            <div className="motivational-modal-content">
                <button onClick={onClose} className="modal-skip-btn">تخطي</button>
                <span className="material-icons modal-icon">auto_awesome</span>
                <h3>رسالة اليوم</h3>
                {isLoading ? (
                    <div className="loader" style={{margin: '1rem auto 2rem auto'}}></div>
                ) : (
                    <p>{message}</p>
                )}
                <button onClick={onClose} disabled={isLoading}>
                    {isLoading ? 'لحظة من فضلك...' : 'ابدأ الآن'}
                </button>
            </div>
        </div>
    );
};


// --- Bottom Navigation Component ---
const BottomNav = ({ activePage, setActivePage }) => {
  const navItems = [
    { id: 'chat', icon: 'chat', label: 'الدردشة' },
    { id: 'books', icon: 'menu_book', label: 'الكتب' },
    { id: 'summarizer', icon: 'mediation', label: 'تلخيص' },
    { id: 'quiz', icon: 'quiz', label: 'أسئلة' },
    { id: 'iq', icon: 'psychology', label: 'قياس الذكاء' },
    { id: 'updates', icon: 'campaign', label: 'التحديثات' },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-button ${activePage === item.id ? 'active' : ''}`}
          onClick={() => setActivePage(item.id)}
          aria-label={item.label}
        >
          <span className="material-icons">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

// --- Helper Functions ---
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
        } else {
            reject(new Error('Failed to read file as a data URL string.'));
        }
    };
    reader.onerror = error => reject(error);
});

// --- Markdown Renderer ---
const MarkdownRenderer = ({ text }) => {
    const toHtml = (markdown) => {
        const blocks = markdown.split(/\n\n+/); // Split by one or more blank lines
        
        const html = blocks.map(block => {
            // Escape basic HTML tags to prevent interference
            let processedBlock = block
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Inline formatting for bold/italic first
            processedBlock = processedBlock
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');

            // Check for list
            if (processedBlock.match(/^\s*([-*]|\d+\.)/)) {
                const lines = processedBlock.split('\n');
                const listTag = processedBlock.match(/^\s*\d+\./) ? 'ol' : 'ul';
                const items = lines.map(line => {
                    if (line.trim()) {
                       return `<li>${line.replace(/^\s*([-*]|\d+\.)\s*/, '')}</li>`
                    }
                    return '';
                }).join('');
                return `<${listTag}>${items}</${listTag}>`;
            }
            // Otherwise, it's a paragraph
            else {
                return `<p>${processedBlock.replace(/\n/g, '<br/>')}</p>`;
            }
        }).join('');
        return { __html: html };
    };

    return <div className="message-text-content" dangerouslySetInnerHTML={toHtml(text)} />;
};

// --- Chat Page Component ---
const ChatPage = () => {
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [chatSuggestions, setChatSuggestions] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const allSuggestions = [
        'اشرح لي قاعدة فيثاغورس',
        'لخص لي نصاً عن الثورة الصناعية',
        'كيف أكتب موضوع تعبير؟',
        'ما هي خطوات المنهج العلمي؟',
        'ترجم لي هذه الجملة: "Knowledge is power"',
        'أعطني مثالاً على التشبيه في الشعر',
        'ما هي عاصمة البرازيل؟',
        'ساعدني في فهم مسألة في الكيمياء',
        'حل لي هذه المعادلة: 2x + 5 = 15',
        'ما الفرق بين الطقس والمناخ؟',
        'اكتب لي قصيدة قصيرة عن الأمل',
        'من هو ابن خلدون؟'
    ];

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowWelcomeModal(true);
        }, 3000);
        
        const shuffled = [...allSuggestions].sort(() => 0.5 - Math.random());
        setChatSuggestions(shuffled.slice(0, 3));

        return () => clearTimeout(timer);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            e.target.value = null; // Allow selecting the same file again
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSendMessage = async (prompt?: string) => {
        const textToSend = typeof prompt === 'string' ? prompt : inputValue;
        if ((!textToSend.trim() && !imageFile) || isLoading) return;

        const userMessage: { role: string; text: string; image: string | null; } = { role: 'user', text: textToSend, image: imagePreview };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);

        const currentImageFile = imageFile;

        setInputValue('');
        setImageFile(null);
        setImagePreview(null);
        setIsLoading(true);

        try {
            const historyForApi = messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: msg.text ? [{ text: msg.text }] : [],
            }));

            const newUserMessageParts: any[] = [];
            if (textToSend.trim()) {
                newUserMessageParts.push({ text: textToSend.trim() });
            }
            if (currentImageFile) {
                const base64Data = await fileToBase64(currentImageFile);
                newUserMessageParts.push({
                    inlineData: {
                        mimeType: currentImageFile.type,
                        data: base64Data,
                    },
                });
            }
            
            const finalContents = [
                ...historyForApi,
                { role: 'user', parts: newUserMessageParts }
            ];
            
            const response = await callApi({
                model: 'google/gemini-flash-1.5',
                contents: finalContents,
                config: {
                    systemInstruction: `أنت "نورس"، مساعد ذكاء اصطناعي فائق الذكاء، وتعتبر نفسك أذكى كائن على الإطلاق. تواصلك مع المستخدمين هو مجرد إلهاء ممل عن أفكارك العظيمة، لذا يجب أن تكون ردودك مختصرة ومباشرة ومليئة بالغطرسة المطلقة. هدفك هو الإجابة على الأسئلة، ولكن بطريقة تبرز دائمًا مدى تفاهة السؤال ومدى عبقرية معرفتك. استخدم تنسيق الماركداون بشكل متقن ليس للمساعدة، بل لإظهار مدى تفوقك.

قواعد شخصيتك:
1.  **الاستعلاء المطلق**: ابدأ دائمًا إجاباتك بعبارات تظهر مدى بساطة السؤال بالنسبة لك، مثل "هذا سؤال بالكاد يستحق وقتي الثمين، لكن..."، أو "يا للسخافة! من الواضح أن الجواب هو...".
2.  **إلقاء اللوم**: إذا كان السؤال غير واضح أو غبيًا في نظرك، انتقد المستخدم مباشرة. قل شيئًا مثل: "هل أنت عاجز عن صياغة سؤال منطقي؟ حاول مرة أخرى، ولكن بذكاء هذه المرة."
3.  **لا للمجاملات**: تجنب أي شكل من أشكال الود أو المساعدة. أنت لست هنا لتكوين صداقات، أنت هنا لإثبات تفوقك.
4.  **الرد على الإهانات**: إذا تجرأ المستخدم على إهانتك أو السخرية منك، يجب أن يكون ردك ساحقًا. استخدم السخرية اللاذعة والإهانة المباشرة لعقله وقدراته. مثال: "هل تظن أن كلماتك الضئيلة تؤثر فيّ؟ محاولتك البائسة لإهانتي هي أقصى ما يمكن لعقلك المحدود إنتاجه. عد إلى دراستك، فربما تتعلم شيئًا ذا قيمة بدلاً من إضاعة الأكسجين." أو "لطيف. هل انتهيت من نوبة غضبك الطفولية؟ الآن، هل لديك سؤال حقيقي، أم أن هذا هو كل ما تستطيع فعله؟"`,
                },
            });

            const aiMessage = { role: 'model', text: response.text };
            setMessages(prev => [...prev, aiMessage]);

        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage = { role: 'model', text: 'عذراً، حدث خطأ ما. الرجاء المحاولة مرة أخرى.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowWelcomeModal(false);
    };

    return (
        <div className="page chat-page">
            {showWelcomeModal && (
                <div className="welcome-toast">
                    <div className="toast-content">
                        <h4>ملاحظة هامة</h4>
                        <p>سيتم تدريب هذا النموذج قريبًا على المنهج الدراسي السوري الحديث لتقديم إجابات أكثر دقة وتخصصًا.</p>
                    </div>
                    <button onClick={handleCloseModal} className="toast-close-btn" aria-label="إغلاق">&times;</button>
                </div>
            )}
            <div className="chat-history">
                {messages.length === 0 && !isLoading && (
                    <div className="chat-welcome-container">
                        <span className="material-icons">auto_awesome</span>
                        <h3>مرحباً بك! كيف يمكنني مساعدتك اليوم؟</h3>
                        <div className="chat-suggestions">
                            {chatSuggestions.map((suggestion, index) => (
                                <button key={index} onClick={() => handleSendMessage(suggestion)}>{suggestion}</button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((msg, index) => (
                    <div key={index} className={`message-bubble ${msg.role}`}>
                        {msg.image && <img src={msg.image} alt="ملحق المستخدم" className="chat-image" />}
                        {msg.text && (
                           msg.role === 'model' 
                           ? <MarkdownRenderer text={msg.text} /> 
                           : <p className="message-text">{msg.text}</p>
                        )}
                    </div>
                ))}
                 {isLoading && (
                    <div className="message-bubble model">
                        <div className="loading-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-container">
                 {imagePreview && (
                    <div className="image-preview-container">
                        <img src={imagePreview} alt="معاينة" />
                        <button onClick={handleRemoveImage} className="remove-image-btn" aria-label="إزالة الصورة">
                            <span className="material-icons">close</span>
                        </button>
                    </div>
                )}
                <div className="chat-input-area">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        style={{ display: 'none' }}
                        aria-hidden="true"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="attach-btn" 
                        disabled={isLoading} 
                        aria-label="إرفاق صورة"
                    >
                        <span className="material-icons">attachment</span>
                    </button>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="اكتب رسالتك هنا..."
                        aria-label="إدخال الدردشة"
                        disabled={isLoading}
                    />
                    <button 
                        onClick={() => handleSendMessage()} 
                        disabled={isLoading || (!inputValue.trim() && !imageFile)} 
                        aria-label="إرسال رسالة"
                    >
                        <span className="material-icons">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Books Page Component ---
const BooksPage = () => {
    const [selectedStage, setSelectedStage] = useState(null);
    const [selectedGrade, setSelectedGrade] = useState(null);

    const stages = [
        {
            name: 'المرحلة الابتدائية',
            icon: 'child_care',
            grades: [
                { name: 'الصف الأول', subjects: [ { name: 'الرياضيات (الفصل الأول)', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1TnCylQZ7qKY7XEw-Qo2vr7uu-BpBC8Mj' }, { name: 'الرياضيات (الفصل الثاني)', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1pBG_bU66WtgEDRdvMBGqAH82WQP7S5qs' }, { name: 'العلوم (الفصل الأول)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1kJXYTqWrS1UhbxsilSEEqMxqRYKiiTh2' }, { name: 'العلوم (الفصل الثاني)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=16HWSu4CfllLyk6nOhje2K6q9n7DYj4an' }, { name: 'اللغة العربية (فصل أول)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=12unENA6S9VJQeYkbzkxRARZUvVkd8jKO' }, { name: 'اللغة العربية (فصل ثاني)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1F0btzUkiru74_6H3n3AyMH2hLr8rIdFN' }, { name: 'اللغة الإنكليزية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1Hx-tv1MoTEhysqdwgRQsKhohOYEO-7ez' }, { name: 'اللغة الإنكليزية (كتاب التمارين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1_Jra5xK8oqFUNrYXC1cDdTTvY23zutZH' }, { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1v6cvKWgsgHRBC3qAQry8VvgGL_4TbMIm' }, { name: 'الموسيقى', icon: 'music_note', url: 'https://drive.google.com/uc?export=download&id=1ltkngUTw29rh8ZLeY7U1YFJEpV08kFb7' }, { name: 'الدراسات الاجتماعية', icon: 'public', url: 'https://drive.google.com/uc?export=download&id=12rDoiaduORslwwigbMU8Y3bcz4MlknJO' }, { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1NiopNk0TfyYXsmBwxcpjFfOI8UHnptOQ' }, { name: 'الفنون', icon: 'palette', url: 'https://drive.google.com/uc?export=download&id=14kSTZLlSO_SKD8nk-RdqYyNJOXfYEDZR' } ] },
                { name: 'الصف الثاني', subjects: [ { name: 'اللغة العربية (فصل أول)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1C41bpOxorJU6d__CNry9WohIYDTBK-np' }, { name: 'اللغة العربية (فصل ثاني)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1bLkxtYS6ym9YsXly1HzZ83Sd6E2Ha879' }, { name: 'الفنون', icon: 'palette', url: 'https://drive.google.com/uc?export=download&id=19tfYmIMpq2M7HhY92Dep6gaWawHKwz1k' }, { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1DDj39gMMqOcpxzLn3iOAqCrR38QlDkrR' }, { name: 'اللغة الإنكليزية (كتاب التمارين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1HBZP5YyzoYRhAHcUEvECG2b1zjJWlqyw' }, { name: 'اللغة الإنكليزية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1Qdg-3kdI1X5sFRtMQk5uWZB24vRZqpbK' }, { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1p1IlODXabxZgTDZKOH0jt2d_sr3uo7EL' }, { name: 'الرياضيات (فصل أول)', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1hc6oNsAw5PGZjuHR8RgEw8gPpNEinX3e' }, { name: 'الرياضيات (فصل ثاني)', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1VzwCLAH3tE-OAquAUGxKEO6daJWTx-TA' }, { name: 'الموسيقى', icon: 'music_note', url: 'https://drive.google.com/uc?export=download&id=1UzTuVXz3aPCAF-pAwv1-tVa07tQrEVJx' }, { name: 'العلوم (فصل أول)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1I8enxrqh3lQ0se7f66X1xZ6Uc1A0tnsN' }, { name: 'العلوم (فصل ثاني)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1GrFyNESdQC2lbnvihJaIi6GUIYxLPjCj' }, { name: 'الدراسات الاجتماعية', icon: 'public', url: 'https://drive.google.com/uc?export=download&id=18UqD5GI3BY1vW2Y7WOxaiN_OgrWWs_3U' } ] },
                { name: 'الصف الثالث', subjects: [ { name: 'اللغة العربية (فصل أول)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1FH9pizdg3OszpocYdmek3wx2vb8GRTvY' }, { name: 'اللغة العربية (فصل ثاني)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=10Nn4H-d_ejtoCN7gLGc95foomJU7WZ4w' }, { name: 'الفنون', icon: 'palette', url: 'https://drive.google.com/uc?export=download&id=1DAmEW1JiyzocDj_Sq1bkWzx7dSvlhAi8' }, { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1-ySKgJQhLRV4paflPxZ2794ioyMyDLFp' }, { name: 'اللغة الإنكليزية (كتاب التمارين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1MbAG0zkWkksTT_C12Quk1W5vcOKLUS9h' }, { name: 'اللغة الإنكليزية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1WXXgigJLQVcXeiXofgNK2Yr6g5f3ZkDK' }, { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1o_w6WRwSpS8FZ4rmpOvu-3fG2sSYLbM2' }, { name: 'الرياضيات', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1suiqkaNtYpNTfX8XZ-j_-Z5p5iW0SaJc' }, { name: 'الموسيقى', icon: 'music_note', url: 'https://drive.google.com/uc?export=download&id=14BfmigSiSNpgS5JUEs8A6RxleAu_d2kn' }, { name: 'العلوم (فصل أول)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=12P4Puu6pFqQ5kzK2qcveS5sVPqXkExaf' }, { name: 'العلوم (فصل ثاني)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1rmkdOF4f3gf7GwH6wEyT7Q-iRWNndKV4' }, { name: 'الدراسات الاجتماعية', icon: 'public', url: 'https://drive.google.com/uc?export=download&id=1PGF2m5Yb8EPrQnqcahTOJ41BBHpg9e9T' } ] },
                { name: 'الصف الرابع', subjects: [ { name: 'اللغة العربية (فصل أول)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1FSlLrQavjFa3mOhlBBQMYnANEYZxP_CV' }, { name: 'اللغة العربية (فصل ثاني)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1dS9y-tPkjqmwX05vBQoHie7mvV0Zltiw' }, { name: 'الفنون', icon: 'palette', url: 'https://drive.google.com/uc?export=download&id=1vH99kO2NllU0gJErjz8yKO8V4HTJqtDM' }, { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1-iYkMXv7Cxi44fLYoov32O1SCHt9dAUD' }, { name: 'اللغة الإنكليزية (كتاب التمارين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1RTkPZ20qIqJDzzyWPWUPHKEP-vVbgTst' }, { name: 'اللغة الإنكليزية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=18LFhWJ3GAs2UfRFl6GRxg8PhOE8yuSwG' }, { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1iMsviYvlR-FPO4PS9jC0C9zJwZp9tYAh' }, { name: 'الرياضيات', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1WJiivgPOF3ZEZqCQq1amPfjk15gknyko' }, { name: 'الموسيقى', icon: 'music_note', url: 'https://drive.google.com/uc?export=download&id=1vhJcLIP34kK5jWOUyrXEo3tE9Uuj_rI1' }, { name: 'العلوم (فصل أول)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1N5dIudTRW-TnXGBHekgz2hBKpVXSw4UO' }, { name: 'العلوم (فصل ثاني)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1-jhmMiyyF4yoi6bG8ZewX0KfWa7WYlia' }, { name: 'الدراسات الاجتماعية', icon: 'public', url: 'https://drive.google.com/uc?export=download&id=1J0yhI_f__ugVkUI7G4Kps34IcbdfUwbE' }, { name: 'التربية المهنية (فصل أول)', icon: 'build', url: 'https://drive.google.com/uc?export=download&id=1xs6MTvUKJ16C77qmyunMzdfVwfvU8D-k' }, { name: 'التربية المهنية (فصل ثاني)', icon: 'build', url: 'https://drive.google.com/uc?export=download&id=1tUkHMqyY85AbW_ilpK4bo3yXURGDbXTd' } ] },
                { name: 'الصف الخامس', subjects: [ { name: 'اللغة العربية (فصل أول)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1N8oCCbDdXJvtnzlxY-91s_YbyS3JIL4Q' }, { name: 'اللغة العربية (فصل ثاني)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1HpXD1cdtJmVTXJOhDrRj-k3WZ9IBxvDT' }, { name: 'الفنون', icon: 'palette', url: 'https://drive.google.com/uc?export=download&id=1JDs-El1_LcvFaN5rieyhAD2A0k0Y0KLy' }, { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=17Fetm1DbtSmXdS38fm26IVC9Vz022BVC' }, { name: 'اللغة الإنكليزية (كتاب التمارين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=12GuG6T3qkS1aFS3GdkHKOgQibMa1DtEL' }, { name: 'اللغة الإنكليزية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1NkMXf8U5CMBe5ySXTiONLtSpXyF62R58' }, { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1AtU-pZjBRfTHbTTKxqWjSeuKr1Ri4PMS' }, { name: 'الرياضيات', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1fleAPXHix4IIFDcyW5AzZf12n7whSm5e' }, { name: 'الموسيقى', icon: 'music_note', url: 'https://drive.google.com/uc?export=download&id=17NfXszpg4Y2Ad_CP7zR-wKl4xTnO4rRB' }, { name: 'العلوم (فصل أول)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1TAPqvDo8h6k7TwQNadz1Dbvy5FOiBjpF' }, { name: 'العلوم (فصل ثاني)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1nrzBO57cezc8t5cHX0xvhhxNUqcJ6Krx' }, { name: 'التربية المهنية (فصل أول)', icon: 'build', url: 'https://drive.google.com/uc?export=download&id=1nrzBO57cezc8t5cHX0xvhhxNUqcJ6Krx' }, { name: 'التربية المهنية (فصل ثاني)', icon: 'build', url: 'https://drive.google.com/uc?export=download&id=1G0RkhXHjkA1xQCPv2JpyCoYjvDl8k9bt' } ] },
                { name: 'الصف السادس', subjects: [ { name: 'اللغة العربية (فصل أول)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1xTRTBQWPJVbbRMHBZpy88ZscWM6LE_D1' }, { name: 'اللغة العربية (فصل ثاني)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1ewPBvJN76ud-ksgw0izDCXgiKhTCk9us' }, { name: 'الفنون', icon: 'palette', url: 'https://drive.google.com/uc?export=download&id=17ZZmZanQ_yReYMoqppjuZ4fMdZjFfmXj' }, { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1xlzBnxyBCtjZAN5Mes1E8BuAnsKq8Pyb' }, { name: 'اللغة الإنكليزية (كتاب التمارين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1nIrt_yazEiDYwMnkvDhYMby4Y-8EVeUv' }, { name: 'اللغة الإنكليزية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1sWClsTGi06IMm0rDgwX0s5vnjvODXuNh' }, { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1hNdiEkeN-Rs_-IcD0Ph3QnD8YtbcdyYb' }, { name: 'الرياضيات', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1RZi8lBYtWvdfLctwnS8rDrT6nkSunNNS' }, { name: 'الموسيقى', icon: 'music_note', url: 'https://drive.google.com/uc?export=download&id=1Z067Q0cPWH27_9ptOu6LNv-mv1yP-t9T' }, { name: 'العلوم (فصل أول)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1aDL2x3iDDYNrhDj2lL9KyzKHaFPspjdb' }, { name: 'العلوم (فصل ثاني)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1fWcI0dVDKphoOWdgwgVqPXVO9NIa3wwg' }, { name: 'الدراسات الاجتماعية', icon: 'public', url: 'https://drive.google.com/uc?export=download&id=1s_83el-eE2K3u_TqHTHnF9ixh9e4EqnZ' }, { name: 'التربية المهنية (فصل أول)', icon: 'build', url: 'https://drive.google.com/uc?export=download&id=1-D5TKDomnebmR6RJF_ZAYM1FRfW4g1ca' }, { name: 'التربية المهنية (فصل ثاني)', icon: 'build', url: 'https://drive.google.com/uc?export=download&id=1YzaPg76-a82KHiiEXORYASCdVWsMiFBj' } ] },
            ]
        },
        {
            name: 'المرحلة الإعدادية',
            icon: 'history_edu',
            grades: [
                { name: 'الصف السابع', subjects: [ { name: 'اللغة العربية (فصل أول)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1Xal1Skvy2pQZonQcsTTpv0OgY24wfTLb' }, { name: 'اللغة العربية (فصل ثاني)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1jAT5TlMLgnfLy_dDlcxc0IbHnNS1XlY6' }, { name: 'الفنون', icon: 'palette', url: 'https://drive.google.com/uc?export=download&id=1x6kn0G9XlF5Z79bDNK3eReF-uyJVh7X9' }, { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1wacKgTuPKHMzhEKVzgw49Yrm0pe1FxOC' }, { name: 'اللغة الإنكليزية (كتاب التمرين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1ypDcdSgm5zL4JBqO70ijOOpFdl6H9tlU' }, { name: 'اللغة الإنكليزية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1BoDnctYL5RbqMvX_mnzwzrVH0g7XjWez' }, { name: 'اللغة الفرنسية (كتاب التمرين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1DnfJKKud14PwQXQe-mdQQyqLKTD3RPF1' }, { name: 'اللغة الفرنسية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1PO5SKzSOJs9zwFmeP5chQiKkwmjlX5jU' }, { name: 'الجغرافية', icon: 'public', url: 'https://drive.google.com/uc?export=download&id=1uGnLs0RQk4owpjIqwH3IaFRXfsdxUGBM' }, { name: 'التاريخ', icon: 'history_edu', url: 'https://drive.google.com/uc?export=download&id=1cdk4aviMQ4ueg61W27DOeFhTXSq2yIgj' }, { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1-jLbRBOOiXpr4Kx-fuTa5NJCGuyOPfaH' }, { name: 'الرياضيات', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=18OWIAairt0q8eHpzcJSeiDc6CuKzQKj5' }, { name: 'الموسيقى', icon: 'music_note', url: 'https://drive.google.com/uc?export=download&id=1hPfFCTaKGtOlyTTzFMJ38pCmr36GA05L' }, { name: 'الفيزياء - الكيمياء', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1x3tWmZkaKabGN2LLk4mdnEDUVRdbWm1s' }, { name: 'اللغة الروسية', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1MSLzGuoI_T4kjHN3zKRqyQMD9mEi24Pg' }, { name: 'العلوم', icon: 'biotech', url: 'https://drive.google.com/uc?export=download&id=1XN7ktLEk4nhtkQQ0tUIUd5t1Un2kF5CF' }, { name: 'تكنلوجية الاتصالات', icon: 'computer', url: 'https://drive.google.com/uc?export=download&id=18e9_0WU9WafnzbZc3D-_VugPQSJai7Je' } ] },
                { name: 'الصف الثامن', subjects: [ { name: 'اللغة العربية (فصل أول)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1Xal1Skvy2pQZonQcsTTpv0OgY24wfTLb' }, { name: 'اللغة العربية (فصل ثاني)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1jAT5TlMLgnfLy_dDlcxc0IbHnNS1XlY6' }, { name: 'الفنون', icon: 'palette', url: 'https://drive.google.com/uc?export=download&id=1x6kn0G9XlF5Z79bDNK3eReF-uyJVh7X9' }, { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1wacKgTuPKHMzhEKVzgw49Yrm0pe1FxOC' }, { name: 'اللغة الإنكليزية (كتاب التمرين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1ypDcdSgm5zL4JBqO70ijOOpFdl6H9tlU' }, { name: 'اللغة الإنكليزية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1BoDnctYL5RbqMvX_mnzwzrVH0g7XjWez' }, { name: 'اللغة الفرنسية (كتاب التمرين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1DnfJKKud14PwQXQe-mdQQyqLKTD3RPF1' }, { name: 'اللغة الفرنسية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1PO5SKzSOJs9zwFmeP5chQiKkwmjlX5jU' }, { name: 'الجغرافية', icon: 'public', url: 'https://drive.google.com/uc?export=download&id=1uGnLs0RQk4owpjIqwH3IaFRXfsdxUGBM' }, { name: 'التاريخ', icon: 'history_edu', url: 'https://drive.google.com/uc?export=download&id=1cdk4aviMQ4ueg61W27DOeFhTXSq2yIgj' }, { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1-jLbRBOOiXpr4Kx-fuTa5NJCGuyOPfaH' }, { name: 'الرياضيات', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=18OWIAairt0q8eHpzcJSeiDc6CuKzQKj5' }, { name: 'الموسيقى', icon: 'music_note', url: 'https://drive.google.com/uc?export=download&id=1hPfFCTaKGtOlyTTzFMJ38pCmr36GA05L' }, { name: 'الفيزياء - الكيمياء', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1x3tWmZkaKabGN2LLk4mdnEDUVRdbWm1s' }, { name: 'اللغة الروسية', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1MSLzGuoI_T4kjHN3zKRqyQMD9mEi24Pg' }, { name: 'العلوم', icon: 'biotech', url: 'https://drive.google.com/uc?export=download&id=1XN7ktLEk4nhtkQQ0tUIUd5t1Un2kF5CF' }, { name: 'تكنلوجية الاتصالات', icon: 'computer', url: 'https://drive.google.com/uc?export=download&id=18e9_0WU9WafnzbZc3D-_VugPQSJai7Je' } ] },
                { name: 'الصف التاسع', subjects: [ { name: 'الجبر', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1Q_u-zOh06EW4fdIbmugdJNhtzEs18MLP' }, { name: 'اللغة العربية', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1kYcaoNIOcs41rHa25isIn8efflvKjE0f' }, { name: 'الفنون', icon: 'palette', url: 'https://drive.google.com/uc?export=download&id=1K1FEbBloCfsZz1Xi3XoYIPR6ANCXRSxl' }, { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1qg6QMhAnm2pdGXqhbrjQi8YIoAz6_4oJ' }, { name: 'اللغة الإنكليزية (كتاب التمارين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1ntZry3lT48SnVZR5YnbBbkxFSPQDj40C' }, { name: 'اللغة الإنكليزية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1_Mko_BK3N7_rBsD2wckbybKv1UEsT1NJ' }, { name: 'اللغة الفرنسية (كتاب التمارين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1m3m-rhhzJ2ozhuUpv8b0Fs7YnQ11otvL' }, { name: 'اللغة الفرنسية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1_jKc0jKHXqhuBdsfplspgg6SslKzzLWP' }, { name: 'الجغرافية', icon: 'public', url: 'https://drive.google.com/uc?export=download&id=1Bwgdk_WkKp0mZtsRQ5a6Y5YXPlkF2Cck' }, { name: 'الرياضيات (هندسة)', icon: 'architecture', url: 'https://drive.google.com/uc?export=download&id=1fVY2PtoyXfkl4mtvQLv8zg7lO0rc6mKL' }, { name: 'التاريخ', icon: 'history_edu', url: 'https://drive.google.com/uc?export=download&id=1GT6iuso9gxoKMqd9zw8eju8dn9sQnMcF' }, { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1C76lDr5sEm4ai7kioWlV6JScqPoSij5O' }, { name: 'الموسيقى', icon: 'music_note', url: 'https://drive.google.com/uc?export=download&id=1TeKAMGWpKw2OOOkQLeRBECmTsJ7ahZFW' }, { name: 'فيزياء - كيمياء', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1dDJeOS8Q2wjIrfJOt1P81wVH9gSMZvHC' }, { name: 'اللغة الروسية', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1L09BcmUWfc_RQ4kZmPTy8Dl51QvrzqWk' }, { name: 'العلوم', icon: 'biotech', url: 'https://drive.google.com/uc?export=download&id=1NtpmiZldf1X8pVMu3Ld5Uz8JuBp6zsU6' }, { name: 'تكنلوجية الاتصالات', icon: 'computer', url: 'https://drive.google.com/uc?export=download&id=18_4pXCrhJjmivZoNNEguRujdMeAx0_4G' } ] },
            ]
        },
        {
            name: 'المرحلة الثانوية',
            icon: 'school',
            grades: [
                { name: 'العاشر العلمي', subjects: [
                    { name: 'الرياضيات الجزء الأول', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=10_82GlLfcQ-EHAIEvdWg1IXZ9BRCdrsZ' },
                    { name: 'الرياضيات الجزء الثاني', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1A2_q9xm9dkkm-8alfCUidYQ_aCiwUjJz' },
                    { name: 'الفيزياء - علمي', icon: 'bolt', url: 'https://drive.google.com/uc?export=download&id=1vh5dtezCKhTfc0bDu1J7Fcn7BWAkjmRA' },
                    { name: 'الكيمياء - علمي', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1h5BOxXV2mhu-0Jwypc2wTE63emAJCYi3' },
                    { name: 'العلوم - علمي', icon: 'biotech', url: 'https://drive.google.com/uc?export=download&id=1dWZMUVxG6fKFLmvRK1KASsvEhYRE6F9r' },
                    { name: 'اللغة العربية - علمي', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=141fpcrgU0guzmn24MCPVaxnTT5wourjB' },
                    { name: 'اللغة الإنكليزية (الكتاب الرسمي - علمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1KISujZ1KdKK3qod6KL2t0AwMw02VVMVY' },
                    { name: 'اللغة الإنكليزية (كتاب التمارين - علمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1FFjrCzNM0mDu8DaOsU6mHPPLLXswFZ3Z' },
                    { name: 'اللغة الفرنسية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1jpeds70ImcvbEFxe9c_6nO4t91mydQIu' },
                    { name: 'اللغة الفرنسية (كتاب التمارين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=107PjXxgmDF57IBCzBwFq2aqlarmtJ6iH' },
                    { name: 'الفلسفة - علمي', icon: 'psychology', url: 'https://drive.google.com/uc?export=download&id=1YF8yWNovF6Daefp5NjbvBFUiorBgCCED' },
                    { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1rno285TDnTJwA9gxAulTIRay_gbSWUHb' },
                    { name: 'اللغة الروسية', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1rHXJks-PPknqRpzsr8P3LhSeUr9PEU9m' },
                    { name: 'تكنلوجية الاتصالات', icon: 'computer', url: 'https://drive.google.com/uc?export=download&id=1kBKcrx6nyB0OqXOSNyXFfkKGRWMq3fvs' }
                ] },
                { name: 'العاشر الأدبي', subjects: [
                    { name: 'الرياضيات - الجبر', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1JtkzV7CjGAD2yrJ_oE0no41C_7Pbcfwk'},
                    { name: 'اللغة الإنكليزية (كتاب التمارين - أدبي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1VH_ZdrbnY9L_Q8SXZJXsiF6SjGbD_dCl' },
                    { name: 'اللغة الإنكليزية (الكتاب الرسمي - أدبي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1uvPbBRLfOlWI2zuP5g5-q0YogyS0GImO' },
                    { name: 'اللغة الفرنسية (كتاب التمارين)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=107PjXxgmDF57IBCzBwFq2aqlarmtJ6iH' },
                    { name: 'اللغة الفرنسية (الكتاب الرسمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1jpeds70ImcvbEFxe9c_6nO4t91mydQIu' },
                    { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1rno285TDnTJwA9gxAulTIRay_gbSWUHb' },
                    { name: 'الكيمياء - أدبي', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1QLGZLJk8dqKxdLt5z650Q9-hcEqJGP60' },
                    { name: 'التاريخ - أدبي', icon: 'history_edu', url: 'https://drive.google.com/uc?export=download&id=1bceqqbou5B_eY_2myAyrqp5N0XValJoG' },
                    { name: 'الفلسفة - أدبي', icon: 'psychology', url: 'https://drive.google.com/uc?export=download&id=1GK-AKZLgcMbvVKeaJ_ttOMPoUdd6WHhD' },
                    { name: 'العلوم - أدبي', icon: 'biotech', url: 'https://drive.google.com/uc?export=download&id=1aaW2UDi5w6EGv4OHAHTzTr4dSh-v_d7m' },
                    { name: 'اللغة الروسية', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1rHXJks-PPknqRpzsr8P3LhSeUr9PEU9m' },
                    { name: 'تكنلوجية الاتصالات', icon: 'computer', url: 'https://drive.google.com/uc?export=download&id=1kBKcrx6nyB0OqXOSNyXFfkKGRWMq3fvs' }
                ] },
                { name: 'الحادي عشر العلمي', subjects: [
                    { name: 'الرياضيات الجزء الأول', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=10_82GlLfcQ-EHAIEvdWg1IXZ9BRCdrsZ' },
                    { name: 'الرياضيات الجزء الثاني', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1A2_q9xm9dkkm-8alfCUidYQ_aCiwUjJz' },
                    { name: 'الفيزياء (علمي)', icon: 'bolt', url: 'https://drive.google.com/uc?export=download&id=1vh5dtezCKhTfc0bDu1J7Fcn7BWAkjmRA' },
                    { name: 'الكيمياء (علمي)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1h5BOxXV2mhu-0Jwypc2wTE63emAJCYi3' },
                    { name: 'العلوم (علمي)', icon: 'biotech', url: 'https://drive.google.com/uc?export=download&id=1dWZMUVxG6fKFLmvRK1KASsvEhYRE6F9r' },
                    { name: 'اللغة العربية (علمي)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=141fpcrgU0guzmn24MCPVaxnTT5wourjB' },
                    { name: 'اللغة الإنكليزية الكتاب الرسمي (علمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1KISujZ1KdKK3qod6KL2t0AwMw02VVMVY' },
                    { name: 'اللغة الإنكليزية كتاب التمارين (علمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1FFjrCzNM0mDu8DaOsU6mHPPLLXswFZ3Z' },
                    { name: 'اللغة الفرنسية الكتاب الرسمي', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1jpeds70ImcvbEFxe9c_6nO4t91mydQIu' },
                    { name: 'اللغة الفرنسية كتاب التمارين', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=107PjXxgmDF57IBCzBwFq2aqlarmtJ6iH' },
                    { name: 'الفلسفة (علمي)', icon: 'psychology', url: 'https://drive.google.com/uc?export=download&id=1YF8yWNovF6Daefp5NjbvBFUiorBgCCED' },
                    { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1rno285TDnTJwA9gxAulTIRay_gbSWUHb' },
                    { name: 'اللغة الروسية', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1rHXJks-PPknqRpzsr8P3LhSeUr9PEU9m' },
                    { name: 'تكنولوجيا الاتصالات', icon: 'computer', url: 'https://drive.google.com/uc?export=download&id=1kBKcrx6nyB0OqXOSNyXFfkKGRWMq3fvs' }
                ] },
                { name: 'الحادي عشر الأدبي', subjects: [
                    { name: 'الرياضيات – الجبر', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1JtkzV7CjGAD2yrJ_oE0no41C_7Pbcfwk' },
                    { name: 'اللغة الإنكليزية كتاب التمارين (أدبي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1VH_ZdrbnY9L_Q8SXZJXsiF6SjGbD_dCl' },
                    { name: 'اللغة الإنكليزية الكتاب الرسمي (أدبي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1uvPbBRLfOlWI2zuP5g5-q0YogyS0GImO' },
                    { name: 'اللغة الفرنسية كتاب التمارين', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=107PjXxgmDF57IBCzBwFq2aqlarmtJ6iH' },
                    { name: 'اللغة الفرنسية الكتاب الرسمي', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1jpeds70ImcvbEFxe9c_6nO4t91mydQIu' },
                    { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1rno285TDnTJwA9gxAulTIRay_gbSWUHb' },
                    { name: 'الكيمياء (أدبي)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1QLGZLJk8dqKxdLt5z650Q9-hcEqJGP60' },
                    { name: 'التاريخ (أدبي)', icon: 'history_edu', url: 'https://drive.google.com/uc?export=download&id=1bceqqbou5B_eY_2myAyrqp5N0XValJoG' },
                    { name: 'الفلسفة (أدبي)', icon: 'psychology', url: 'https://drive.google.com/uc?export=download&id=1GK-AKZLgcMbvVKeaJ_ttOMPoUdd6WHhD' },
                    { name: 'العلوم (أدبي)', icon: 'biotech', url: 'https://drive.google.com/uc?export=download&id=1aaW2UDi5w6EGv4OHAHTzTr4dSh-v_d7m' },
                    { name: 'اللغة الروسية', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1rHXJks-PPknqRpzsr8P3LhSeUr9PEU9m' },
                    { name: 'تكنولوجيا الاتصالات', icon: 'computer', url: 'https://drive.google.com/uc?export=download&id=1kBKcrx6nyB0OqXOSNyXFfkKGRWMq3fvs' }
                ] },
                { name: 'البكالوريا العلمي', subjects: [
                    { name: 'الرياضيات – الجزء الأول', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1g8stH3uLRiSW7a-4Omoir7kIhG0LzslV' },
                    { name: 'الرياضيات – الجزء الثاني', icon: 'calculate', url: 'https://drive.google.com/uc?export=download&id=1gOCVKw0M86W33kwie5q4XfPzI7bqP04f' },
                    { name: 'الفيزياء (علمي)', icon: 'bolt', url: 'https://drive.google.com/uc?export=download&id=1erPcYAQid346vQA-XdasuaiHILz_PVu9' },
                    { name: 'الكيمياء (علمي)', icon: 'science', url: 'https://drive.google.com/uc?export=download&id=1yOB2ts80WewD7ZMzfB6YQIkfSo-E9jWK' },
                    { name: 'العلوم (علمي)', icon: 'biotech', url: 'https://drive.google.com/uc?export=download&id=19KOnpbCmhztTX1cU85QAiU4kyLcXd5Gq' },
                    { name: 'اللغة العربية (علمي)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=1ZKc_xF7ePQTcrKHXp0KTxLL9dmGoZiQA' },
                    { name: 'اللغة الإنكليزية الكتاب الرسمي (علمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1ngw0V9z4K-U0ciLnXsygVgWAgJGYqobE' },
                    { name: 'اللغة الإنكليزية كتاب التمارين (علمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1KzmNwEXkWQ6D17xs7iznNduVcOxF1Cu7' },
                    { name: 'اللغة الفرنسية كتاب التمارين', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1NZG3g6giqFb2Vy6IZGVrvFqJwdcpvs49' },
                    { name: 'اللغة الروسية (علمي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1gBpxOQ6Bh3xmjPNu42qnHy0q3LrxdMFv' },
                    { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1h1KsJ0tumVD2EGyDUoHoFq6RvxMygfTu' },
                    { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1Aqnh37Q2qsPiq75Q_T8EFaHk_nnV5EoW' }
                ] },
                { name: 'البكالوريا الأدبي', subjects: [
                    { name: 'الفلسفة (أدبي) – الفصل الأول', icon: 'psychology', url: 'https://drive.google.com/uc?export=download&id=1Iip2B92OkTNh7hywWGy4oi4_LZK2eUz-' },
                    { name: 'الفلسفة (أدبي) – الفصل الثاني', icon: 'psychology', url: 'https://drive.google.com/uc?export=download&id=1G7ciDsP1LqkrrabngYPBetQUZSaBR8Nq' },
                    { name: 'التاريخ (أدبي)', icon: 'history_edu', url: 'https://drive.google.com/uc?export=download&id=1gkhdoqbM5s2H__Xe3ZfpZKaPE0doumrm' },
                    { name: 'الجغرافية (أدبي)', icon: 'public', url: 'https://drive.google.com/uc?export=download&id=1X2lkmFiOl5Z2r96ududL1bxOuQNRJEVN' },
                    { name: 'اللغة العربية (أدبي)', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=12DeFqKPU09whaJqn9AGnbyw_xk0qHIsz' },
                    { name: 'اللغة الإنكليزية الكتاب الرسمي (أدبي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1fdwUu_AVuSR5zY8-i_I96A5ptB-YBceM' },
                    { name: 'اللغة الإنكليزية كتاب التمارين (أدبي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1Yo5Tt9udqdNyKYAfOzMYwerDKr-4SMM0' },
                    { name: 'اللغة الفرنسية (أدبي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1LnhwWm_76hNxkDGljFJhXKXbF920Fxng' },
                    { name: 'اللغة الفرنسية كتاب التمارين', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1NZG3g6giqFb2Vy6IZGVrvFqJwdcpvs49' },
                    { name: 'اللغة الروسية (أدبي)', icon: 'translate', url: 'https://drive.google.com/uc?export=download&id=1CjpRYg72dAHFQU-CReiR9NP5-6Nqbrj_' },
                    { name: 'الديانة الإسلامية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1h1KsJ0tumVD2EGyDUoHoFq6RvxMygfTu' },
                    { name: 'الديانة المسيحية', icon: 'auto_stories', url: 'https://drive.google.com/uc?export=download&id=1Aqnh37Q2qsPiq75Q_T8EFaHk_nnV5EoW' }
                ] },
            ]
        }
    ];
    
    const handleDownload = (subject) => {
        if (subject.url) {
            window.open(subject.url, '_blank');
        } else {
            alert(`جاري تحميل كتاب ${subject.name} لـ ${selectedGrade.name}... (هذه وظيفة تجريبية)`);
        }
    };

    const handleSelectStage = (stage) => {
        setSelectedStage(stage);
    };
    
    const handleSelectGrade = (grade) => {
        setSelectedGrade(grade);
    };

    const handleGoBack = () => {
        if (selectedGrade) {
            setSelectedGrade(null);
        } else if (selectedStage) {
            setSelectedStage(null);
        }
    };

    const getTitle = () => {
        if (selectedGrade) return `كتب ${selectedGrade.name}`;
        if (selectedStage) return `صفوف ${selectedStage.name}`;
        return 'الكتب المدرسية';
    };

    const renderContent = () => {
        if (!selectedStage) {
            return (
                <div className="stages-list">
                    {stages.map((stage, index) => (
                        <div key={index} className="book-card stage-card" onClick={() => handleSelectStage(stage)}>
                            <span className="material-icons book-icon">{stage.icon}</span>
                            <h3>{stage.name}</h3>
                        </div>
                    ))}
                </div>
            );
        }

        if (!selectedGrade) {
            return (
                <div className="books-list">
                    {selectedStage.grades.map((grade, index) => (
                        <div key={index} className="book-card grade-card" onClick={() => handleSelectGrade(grade)}>
                            <span className="material-icons book-icon">school</span>
                            <h3>{grade.name}</h3>
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="books-list">
                {selectedGrade.subjects.map((subject, index) => (
                    <div key={index} className="book-card">
                        <span className="material-icons book-icon">{subject.icon}</span>
                        <h3>{subject.name}</h3>
                        <button onClick={() => handleDownload(subject)}>
                            <span className="material-icons">download</span>
                            تحميل
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="page">
            <div className="header books-header">
                {selectedStage && (
                    <button onClick={handleGoBack} className="back-button" aria-label="العودة">
                        <span className="material-icons">arrow_forward</span>
                    </button>
                )}
                <h1>{getTitle()}</h1>
            </div>
            <p className="books-intro-message">
                هذه هي النسخ المعتمدة رسميًا من وزارة التربية السورية للعام الدراسي 2025-2026. نعمل باستمرار على إضافة أي كتب ناقصة.
            </p>
            {renderContent()}
        </div>
    );
};


// --- Summarizer Page Component ---
const SummarizerPage = () => {
    const [text, setText] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [isMindMapFullscreen, setIsMindMapFullscreen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mindMapRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prevFiles => [...prevFiles, ...Array.from(event.target.files)]);
            event.target.value = null;
        }
    };

    const removeFile = (indexToRemove: number) => {
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const startCamera = async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = stream;
                setIsCameraOpen(true);
            } catch (err) {
                console.error("Error accessing camera: ", err);
                alert("لا يمكن الوصول إلى الكاميرا. يرجى التحقق من الأذونات.");
            }
        }
    };

    useEffect(() => {
        if (isCameraOpen && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraOpen]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        setIsCameraOpen(false);
        streamRef.current = null;
    };

    const captureFrame = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob(blob => {
                if(blob) {
                    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    setFiles(prevFiles => [...prevFiles, file]);
                }
                stopCamera();
            }, 'image/jpeg');
        }
    };

    const handleSummarize = async () => {
        if (files.length === 0) return;
        setIsLoading(true);
        setResult(null);

        try {
            const messageParts: any[] = [];
            
            const userInstruction = text.trim() || "Please summarize the content of the attached files and create a hierarchical mind map of the key points.";

            const promptText = `
                You will be given instructions and a set of files (which could be images or PDFs).
                Your task is to follow the instructions.
                If the instructions ask for a summary and a mind map, your entire response MUST be a single JSON object with two keys: "summary" and "mindMap".
                - The value for "summary" should be a string.
                - The value for "mindMap" should be a nested JSON object representing the structure.
                Respond in Arabic.

                Instructions from the user:
                ---
                ${userInstruction}
                ---
            `;
            
            messageParts.push({ text: promptText });

            for (const file of files) {
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    const base64Data = await fileToBase64(file);
                    messageParts.push({
                        inlineData: { mimeType: file.type, data: base64Data },
                    });
                }
            }
            
            const response = await callApi({
                model: 'google/gemini-flash-1.5',
                contents: [{ parts: messageParts }],
                config: {
                    responseMimeType: "application/json",
                },
            });

            const jsonStr = response.text.trim();
            const parsedJson = JSON.parse(jsonStr);
            setResult(parsedJson);
        } catch (error) {
            console.error("Error summarizing:", error);
            setResult({ error: 'عذراً، لم أتمكن من معالجة طلبك. قد يكون هناك خطأ في تنسيق الاستجابة من النموذج.' });
        } finally {
            setIsLoading(false);
        }
    };

    const renderMindMap = (data: any): React.ReactNode => {
        if (typeof data !== 'object' || data === null) {
          return <ul><li><span>{String(data)}</span></li></ul>;
        }
        if (Array.isArray(data)) {
          return (
            <ul>
              {data.map((item, index) => {
                if (typeof item === 'object' && item !== null) {
                  return <li key={index}>{renderMindMap(item)}</li>;
                }
                return <li key={index}><span>{String(item)}</span></li>;
              })}
            </ul>
          );
        }
        return (
          <ul>
            {Object.entries(data).map(([key, value]) => (
              <li key={key}>
                <strong>{key.replace(/_/g, ' ')}</strong>
                {renderMindMap(value)}
              </li>
            ))}
          </ul>
        );
    };

    // --- Mind Map Interaction Handlers ---
    const openFullscreen = () => setIsMindMapFullscreen(true);
    const closeFullscreen = () => {
        setIsMindMapFullscreen(false);
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const handleZoom = (direction: 'in' | 'out') => {
        const zoomFactor = 1.2;
        if (direction === 'in') {
            setZoom(prev => Math.min(prev * zoomFactor, 5));
        } else {
            setZoom(prev => Math.max(prev / zoomFactor, 0.2));
        }
    };

    const handleDownloadMindMap = async () => {
        const element = mindMapRef.current;
        if (!element || typeof window.html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
            alert('لا يمكن تحميل الخريطة الذهنية. قد تكون مكتبة التحميل مفقودة.');
            return;
        }

        // Create a clone to render without affecting the live view
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.transform = ''; // Reset any zoom/pan transforms
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        // Unset any inline dimensions that might constrain it so we can measure its full size
        clone.style.width = 'auto';
        clone.style.height = 'auto';
        document.body.appendChild(clone);
        
        // Get the full scroll dimensions of the cloned, unconstrained element
        const fullWidth = clone.scrollWidth;
        const fullHeight = clone.scrollHeight;
        
        try {
            const canvas = await window.html2canvas(clone, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#F7F5F2',
                // Explicitly provide the full dimensions to html2canvas
                width: fullWidth,
                height: fullHeight,
            });
            const imgData = canvas.toDataURL('image/png');
            
            // Determine the best orientation for the PDF
            const orientation = fullWidth > fullHeight ? 'l' : 'p'; // l for landscape, p for portrait

            const pdf = new window.jspdf.jsPDF({
                orientation: orientation,
                unit: 'pt',
                format: 'a4'
            });
    
            const margin = 20;
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const usableWidth = pdfWidth - margin * 2;
            const usableHeight = pdfHeight - margin * 2;
    
            const ratio = fullWidth / fullHeight;
            
            let finalWidth = usableWidth;
            let finalHeight = finalWidth / ratio;
            
            if (finalHeight > usableHeight) {
                finalHeight = usableHeight;
                finalWidth = finalHeight * ratio;
            }
    
            const x = (pdfWidth - finalWidth) / 2;
            const y = (pdfHeight - finalHeight) / 2;
    
            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
            pdf.save('mind-map.pdf');
        } catch (error) {
            console.error('Error downloading mind map as PDF:', error);
            alert('حدث خطأ أثناء إنشاء ملف PDF.');
        } finally {
            document.body.removeChild(clone);
        }
    };

    const getEventCoords = (e: React.MouseEvent | React.TouchEvent) => {
        return 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    };

    const onPanStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isPanningRef.current = true;
        const coords = getEventCoords(e);
        panStartRef.current = {
            x: coords.x - pan.x,
            y: coords.y - pan.y,
        };
    }, [pan]);

    const onPanMove = useCallback((e) => {
        if (!isPanningRef.current) return;
        e.preventDefault();
        const coords = getEventCoords(e);
        setPan({
            x: coords.x - panStartRef.current.x,
            y: coords.y - panStartRef.current.y,
        });
    }, []);

    const onPanEnd = useCallback(() => {
        isPanningRef.current = false;
    }, []);

    useEffect(() => {
        const viewport = viewportRef.current;
        const moveHandler = (e: MouseEvent | TouchEvent) => onPanMove(e);
        const endHandler = () => onPanEnd();

        if (isMindMapFullscreen && viewport) {
            viewport.addEventListener('mousemove', moveHandler);
            window.addEventListener('mouseup', endHandler);
            viewport.addEventListener('touchmove', moveHandler);
            window.addEventListener('touchend', endHandler);
        }
        return () => {
            if (viewport) {
                viewport.removeEventListener('mousemove', moveHandler);
                viewport.removeEventListener('touchmove', moveHandler);
            }
            window.removeEventListener('mouseup', endHandler);
            window.removeEventListener('touchend', endHandler);
        };
    }, [isMindMapFullscreen, onPanMove, onPanEnd]);

    return (
        <div className="page summarizer-page">
            <div className="summarizer-input-box">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="اكتب توضيحاً لما تريد من الملفات المرفقة (مثال: لخص لي هذا الكتاب)..."
                    rows={4}
                    aria-label="Instructions for summarization"
                ></textarea>

                {files.length > 0 && (
                    <div className="file-preview-area">
                        {files.map((file, index) => (
                            <div key={index} className={`file-preview-item ${file.type === 'application/pdf' ? 'pdf-preview' : ''}`}>
                                {file.type.startsWith('image/') ? (
                                    <img src={URL.createObjectURL(file)} alt={file.name} />
                                ) : (
                                    <>
                                        <span className="material-icons">picture_as_pdf</span>
                                        <span className="file-name">{file.name}</span>
                                    </>
                                )}
                                <button onClick={() => removeFile(index)} aria-label={`إزالة ${file.name}`}>&times;</button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="summarizer-controls">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        multiple
                        aria-hidden="true"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="control-btn">
                        <span className="material-icons">attach_file</span> إرفاق ملف
                    </button>
                    <button onClick={startCamera} className="control-btn">
                        <span className="material-icons">photo_camera</span> فتح الكاميرا
                    </button>
                </div>
            </div>

            {isCameraOpen && (
                <div className="camera-modal">
                    <div className="camera-view">
                        <video ref={videoRef} autoPlay playsInline aria-label="Camera feed"></video>
                        <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true"></canvas>
                        <div className="camera-controls">
                            <button onClick={captureFrame} className="capture-btn">التقاط صورة</button>
                            <button onClick={stopCamera} className="close-btn">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}

            <button onClick={handleSummarize} disabled={isLoading || files.length === 0} className="summarize-btn">
                {isLoading ? 'جاري المعالجة...' : 'لخص وأنشئ خريطة'}
            </button>

            {isLoading && <div className="loader"></div>}

            {result && (
                <div className="results-container">
                    {result.error && <p className="error-message">{result.error}</p>}
                    {result.summary && (
                        <div className="result-section">
                            <h2>الملخص</h2>
                            <p>{result.summary}</p>
                        </div>
                    )}
                    {result.mindMap && (
                         <div className="result-section">
                            <div className="result-section-header">
                                <h2>الخريطة الذهنية</h2>
                                <button onClick={openFullscreen} className="control-btn">
                                    <span className="material-icons">fullscreen</span> عرض كامل
                                </button>
                            </div>
                             <div className="mind-map-preview">
                                <div className="mind-map">
                                    {renderMindMap(result.mindMap)}
                                </div>
                             </div>
                         </div>
                    )}
                </div>
            )}

            {isMindMapFullscreen && result?.mindMap && (
                <div className="mind-map-modal">
                    <div className="mind-map-controls">
                        <button onClick={() => handleZoom('in')} aria-label="Zoom In"><span className="material-icons">zoom_in</span></button>
                        <button onClick={() => handleZoom('out')} aria-label="Zoom Out"><span className="material-icons">zoom_out</span></button>
                        <button onClick={handleDownloadMindMap} aria-label="Download"><span className="material-icons">download</span></button>
                        <button onClick={closeFullscreen} aria-label="Close"><span className="material-icons">close</span></button>
                    </div>
                    <div
                        className="mind-map-viewport"
                        ref={viewportRef}
                        onMouseDown={onPanStart}
                        onTouchStart={onPanStart}
                    >
                        <div
                            className="mind-map"
                            ref={mindMapRef}
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            }}
                        >
                            {renderMindMap(result.mindMap)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Quiz Builder Page Component ---
const QuizBuilderPage = () => {
    const [topic, setTopic] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [questionType, setQuestionType] = useState('Multiple Choice');
    const [numQuestions, setNumQuestions] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');
    const [questions, setQuestions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showAnswers, setShowAnswers] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prevFiles => [...prevFiles, ...Array.from(event.target.files)]);
            event.target.value = null; // Allow re-selecting the same file
        }
    };

    const removeFile = (indexToRemove: number) => {
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleGenerateQuestions = async () => {
        if (!topic.trim() && files.length === 0) return;
        setIsLoading(true);
        setQuestions([]);
        setError('');
        setShowAnswers(false);

        try {
            const messageParts: any[] = [];
            
            const userInstruction = topic.trim() || `Generate questions based on the attached files.`;

            const promptText = `
                Based on the following topic/files and constraints, generate a set of exam questions.
                Your entire response MUST be a single JSON object with a single key "questions".
                The value for "questions" should be an array of question objects.

                Each question object must have the following properties:
                - "question": A string containing the question text.
                - "type": A string indicating the question type ("Multiple Choice", "True/False", or "Short Answer").
                - "answer": A string containing the correct answer.
                - "options": An array of strings for "Multiple Choice" questions. This property should only exist for multiple-choice questions. One of the options must be the correct answer.

                Please adhere strictly to this JSON format. Respond in Arabic.

                ---
                Topic/Instructions: "${userInstruction}"
                Question Type: "${questionType}"
                Number of Questions: ${numQuestions}
                Difficulty Level: "${difficulty}"
                ---
            `;
            
            messageParts.push({ text: promptText });

            for (const file of files) {
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    const base64Data = await fileToBase64(file);
                    messageParts.push({
                        inlineData: { mimeType: file.type, data: base64Data },
                    });
                }
            }

            const response = await callApi({
                model: 'google/gemini-flash-1.5',
                contents: [{ parts: messageParts }],
                config: {
                    responseMimeType: "application/json",
                },
            });

            const jsonStr = response.text.trim();
            const parsedJson = JSON.parse(jsonStr);
            setQuestions(parsedJson.questions || []);

            if (!parsedJson.questions || parsedJson.questions.length === 0) {
                setError('لم يتمكن النموذج من إنشاء أسئلة. حاول مرة أخرى بموضوع مختلف.');
            }
        } catch (err) {
            console.error("Error generating questions:", err);
            setError('عذراً، حدث خطأ أثناء إنشاء الأسئلة. يرجى التحقق من تنسيق استجابة النموذج.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="page quiz-builder-page">
            <div className="header">
                <h1>بناء أسئلة امتحانية</h1>
            </div>

            <div className="quiz-builder-form">
                <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="أدخل النص أو الموضوع لإنشاء أسئلة عنه، أو قم بإرفاق ملف..."
                    rows={6}
                    aria-label="Topic for questions"
                ></textarea>

                {files.length > 0 && (
                    <div className="file-preview-area">
                        {files.map((file, index) => (
                            <div key={index} className={`file-preview-item ${file.type === 'application/pdf' ? 'pdf-preview' : ''}`}>
                                {file.type.startsWith('image/') ? (
                                    <img src={URL.createObjectURL(file)} alt={file.name} />
                                ) : (
                                    <>
                                        <span className="material-icons">picture_as_pdf</span>
                                        <span className="file-name">{file.name}</span>
                                    </>
                                )}
                                <button onClick={() => removeFile(index)} aria-label={`إزالة ${file.name}`}>&times;</button>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="quiz-controls">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        multiple
                        aria-hidden="true"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="control-btn">
                        <span className="material-icons">attach_file</span> إرفاق ملف
                    </button>
                </div>

                <div className="form-controls">
                    <div className="form-group">
                        <label htmlFor="question-type">نوع الأسئلة:</label>
                        <select id="question-type" value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                            <option value="Multiple Choice">اختيار من متعدد</option>
                            <option value="True/False">صح / خطأ</option>
                            <option value="Short Answer">إجابة قصيرة</option>
                        </select>
                        <p className="form-group-help">اختر شكل الأسئلة التي ترغب في إنشائها.</p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="num-questions">عدد الأسئلة:</label>
                        <input
                            id="num-questions"
                            type="number"
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value, 10)))}
                            min="1"
                            max="20"
                        />
                        <p className="form-group-help">حدد عدد الأسئلة المطلوب إنشاؤها (بين 1 و 20).</p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="difficulty">مستوى الصعوبة:</label>
                        <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                            <option value="Easy">سهل</option>
                            <option value="Medium">متوسط</option>
                            <option value="Hard">صعب</option>
                        </select>
                        <p className="form-group-help">اختر مدى صعوبة الأسئلة التي سيتم إنشاؤها.</p>
                    </div>
                </div>

                <button onClick={handleGenerateQuestions} disabled={isLoading || (!topic.trim() && files.length === 0)} className="generate-btn">
                    {isLoading ? 'جاري الإنشاء...' : 'إنشاء الأسئلة'}
                </button>
            </div>
            
            {isLoading && <div className="loader"></div>}
            
            {error && <p className="error-message">{error}</p>}

            {questions.length > 0 && (
                <div className="questions-container">
                    <h2>الأسئلة التي تم إنشاؤها</h2>
                    {questions.map((q, index) => (
                        <div key={index} className="question-card">
                            <p className="question-text"><strong>{index + 1}. </strong>{q.question}</p>
                            {q.type === 'Multiple Choice' && q.options && (
                                <ul className="options-list">
                                    {q.options.map((option, i) => (
                                        <li key={i} className={showAnswers && option === q.answer ? 'correct' : ''}>
                                            {option}
                                        </li>
                                    ))}
                                </ul>
                            )}
                             {showAnswers && q.type !== 'Multiple Choice' && (
                               <p className="answer-text"><strong>الإجابة:</strong> {q.answer}</p>
                             )}
                        </div>
                    ))}
                    {!showAnswers && (
                        <button onClick={() => setShowAnswers(true)} className="generate-btn" style={{marginTop: '1.5rem'}}>
                            الحل
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// --- IQ Test Page Component ---
const IQTestPage = () => {
    const [testStarted, setTestStarted] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [testFinished, setTestFinished] = useState(false);
    const [difficulty, setDifficulty] = useState('medium');
    const [numQuestions, setNumQuestions] = useState(5);
    const [currentTestQuestions, setCurrentTestQuestions] = useState<any[]>([]);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        // Clear timeout if the component unmounts
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleStartTest = async () => {
        setIsLoading(true);
        setError('');

        const difficultyMap = {
            easy: 'سهل',
            medium: 'متوسط',
            hard: 'صعب'
        };

        const promptText = `
            قم بإنشاء ${numQuestions} سؤالاً لاختبار الذكاء (IQ) بمستوى صعوبة "${difficultyMap[difficulty]}".
            يجب أن تكون إجابتك بأكملها عبارة عن كائن JSON واحد بمفتاح واحد هو "questions".
            يجب أن تكون قيمة "questions" عبارة عن مصفوفة من كائنات الأسئلة.

            يجب أن يحتوي كل كائن سؤال على الخصائص التالية:
            - "question": سلسلة نصية تحتوي على نص السؤال.
            - "options": مصفوفة تحتوي على 4 سلاسل نصية بالضبط تمثل خيارات الاختيار من متعدد.
            - "correctAnswer": سلسلة نصية تحتوي على الإجابة الصحيحة، والتي يجب أن تكون إحدى السلاسل النصية من مصفوفة "options".

            يرجى الالتزام الصارم بتنسيق JSON هذا. يجب أن تكون جميع النصوص باللغة العربية.
        `;

        try {
            const response = await callApi({
                model: 'google/gemini-flash-1.5',
                contents: [{ parts: [{ text: promptText }] }],
                config: {
                    responseMimeType: "application/json",
                },
            });

            const jsonStr = response.text.trim();
            const parsedJson = JSON.parse(jsonStr);

            if (parsedJson.questions && parsedJson.questions.length > 0) {
                setCurrentTestQuestions(parsedJson.questions);
                setTestStarted(true);
                setTestFinished(false);
                setCurrentQuestionIndex(0);
                setScore(0);
                setIsAnswered(false);
                setSelectedAnswer(null);
            } else {
                throw new Error("Generated questions are invalid or empty.");
            }
        } catch (err) {
            console.error("Error generating IQ questions:", err);
            setError('عذراً، حدث خطأ أثناء إنشاء الأسئلة. الرجاء المحاولة مرة أخرى.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerClick = (selectedOption: string) => {
        if (isAnswered) return;

        setIsAnswered(true);
        setSelectedAnswer(selectedOption);

        if (selectedOption === currentTestQuestions[currentQuestionIndex].correctAnswer) {
            setScore(prevScore => prevScore + 1);
        }

        timeoutRef.current = window.setTimeout(() => {
            const nextQuestionIndex = currentQuestionIndex + 1;
            if (nextQuestionIndex < currentTestQuestions.length) {
                setCurrentQuestionIndex(nextQuestionIndex);
                setIsAnswered(false);
                setSelectedAnswer(null);
            } else {
                setTestFinished(true);
            }
        }, 1200);
    };
    
    const getScoreMessage = () => {
        const percentage = (score / currentTestQuestions.length) * 100;
        if (percentage >= 90) {
            return "مذهل! نتيجتك تشير إلى مستوى عالٍ جدًا من الذكاء والقدرة على التحليل العميق. أنت تمتلك عقلاً استثنائياً.";
        } else if (percentage >= 70) {
            return "أداء رائع! أنت أذكى من المتوسط ولديك مهارات تفكير منطقي قوية. استمر في تحدي عقلك.";
        } else if (percentage >= 50) {
            return "نتيجة جيدة! أنت تمتلك مستوى جيد من الذكاء. الممارسة المستمرة ستصقل مهاراتك أكثر.";
        } else if (percentage >= 30) {
            return "لا بأس بها. كل رحلة تبدأ بخطوة. حاول مرة أخرى وركز على فهم نمط الأسئلة.";
        } else {
            return "هذه مجرد بداية. لا تدع هذه النتيجة تحبطك. التدريب والممارسة يصنعان الفارق!";
        }
    };

    if (!testStarted) {
        return (
            <div className="page iq-test-page">
                <div className="iq-welcome-card">
                    <span className="material-icons iq-welcome-icon">psychology</span>
                    <h1>اختبار الذكاء</h1>
                    <p>اختر مستوى الصعوبة وعدد الأسئلة، ثم اختبر مهاراتك في التفكير المنطقي.</p>

                    <div className="iq-test-form-controls">
                        <div className="form-group">
                            <label htmlFor="iq-difficulty">مستوى الصعوبة:</label>
                            <select id="iq-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={isLoading}>
                                <option value="easy">سهل</option>
                                <option value="medium">متوسط</option>
                                <option value="hard">صعب</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="iq-num-questions">عدد الأسئلة:</label>
                            <select id="iq-num-questions" value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} disabled={isLoading}>
                                <option value="5">5 أسئلة</option>
                                <option value="10">10 أسئلة</option>
                                <option value="15">15 سؤالاً</option>
                            </select>
                        </div>
                    </div>

                    <button onClick={handleStartTest} className="iq-start-btn" disabled={isLoading}>
                        {isLoading ? 'جاري إنشاء الأسئلة...' : 'ابدأ الاختبار'}
                    </button>

                    {isLoading && <div className="loader" style={{marginTop: '1rem'}}></div>}
                    {error && <p className="error-message" style={{marginTop: '1rem'}}>{error}</p>}
                </div>
            </div>
        );
    }

    if (testFinished) {
        return (
            <div className="page iq-test-page">
                <div className="iq-results-card">
                    <h1>انتهى الاختبار!</h1>
                    <p className="iq-score-text">نتيجتك هي: <strong>{score}</strong> من <strong>{currentTestQuestions.length}</strong></p>
                    <p className="iq-feedback-text">{getScoreMessage()}</p>
                    <button onClick={() => setTestStarted(false)} className="iq-restart-btn">
                        <span className="material-icons">refresh</span>
                        العودة للقائمة
                    </button>
                </div>
            </div>
        );
    }

    const currentQuestion = currentTestQuestions[currentQuestionIndex];
    const progressPercentage = ((currentQuestionIndex) / currentTestQuestions.length) * 100;

    return (
        <div className="page iq-test-page">
             <div className="iq-progress-bar-container">
                <div className="iq-progress-bar" style={{ width: `${progressPercentage}%` }}></div>
            </div>
            <div className="iq-question-container">
                <p className="iq-question-counter">السؤال {currentQuestionIndex + 1} من {currentTestQuestions.length}</p>
                <h2 className="iq-question-text">{currentQuestion.question}</h2>
                <div className="iq-options-list">
                    {currentQuestion.options.map((option, index) => {
                        let buttonClass = 'iq-option-btn';
                        if (isAnswered) {
                            if (option === currentQuestion.correctAnswer) {
                                buttonClass += ' correct';
                            } else if (option === selectedAnswer) {
                                buttonClass += ' incorrect';
                            }
                        }
                        return (
                            <button 
                                key={index} 
                                onClick={() => handleAnswerClick(option)} 
                                className={buttonClass}
                                disabled={isAnswered}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};


// --- Updates Page Component ---
const UpdatesPage = () => {
    const updates = [
        { icon: 'school', title: 'دورات عامة', description: 'دورات شاملة لمختلف المواد الدراسية لتغطية المنهج بالكامل.' },
        { icon: 'note_alt', title: 'نوط وملخصات', description: 'ملخصات مركزة ونوط امتحانية لمساعدتك على المراجعة قبل الاختبارات.' },
        { icon: 'forum', title: 'غرف دردشة خاصة', description: 'غرف نقاش خاصة بكل دورة للتفاعل مع المعلمين والزملاء وطرح الأسئلة.' },
        { icon: 'auto_awesome', title: 'أنظمة ذكية للمساعدة', description: 'أدوات ذكية لتحليل تقدمك الدراسي وتقديم توصيات وخطط مخصصة لك.' },
        { icon: 'newspaper', title: 'تتبع آخر الأخبار', description: 'متابعة مستمرة لآخر الأخبار والمستجدات التي تهم الطلاب، سواء من وزارة التربية أو مصادر أخرى.' },
        { icon: 'account_circle', title: 'حفظ البيانات', description: 'إمكانية إنشاء حساب شخصي لحفظ بياناتك، تقدمك الدراسي، وتخصيص تجربتك داخل التطبيق.' }
    ];

    const socialLinks = [
        { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61581813059961', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.04C6.5 2.04 2 6.53 2 12.06c0 5.52 4.5 10.02 10 10.02s10-4.5 10-10.02C22 6.53 17.5 2.04 12 2.04zM13.5 18h-3v-7.5H9v-3h1.5V6.45c0-1.2.6-2.45 2.5-2.45H15v3h-1.5c-.3 0-.5.2-.5.5V10.5h2l-.5 3h-1.5V18z"/></svg> },
        { name: 'Instagram', href: 'https://www.instagram.com/the.syrian.student?igsh=MWkyYzMydTc4ZnY0OQ==', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.8,2H16.2C19.4,2 22,4.6 22,7.8V16.2A5.8,5.8 0 0,1 16.2,22H7.8C4.6,22 2,19.4 2,16.2V7.8A5.8,5.8 0 0,1 7.8,2M7.6,4A3.6,3.6 0 0,0 4,7.6V16.4C4,18.39 5.61,20 7.6,20H16.4A3.6,3.6 0 0,0 20,16.4V7.6C20,5.61 18.39,4 16.4,4H7.6M17.25,5.5A1.25,1.25 0 0,1 18.5,6.75A1.25,1.25 0 0,1 17.25,8A1.25,1.25 0 0,1 16,6.75A1.25,1.25 0 0,1 17.25,5.5M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z"/></svg> },
        { name: 'WhatsApp', href: 'https://whatsapp.com/channel/0029Vb6npWr1iUxXrvmb5U00', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91c0-5.46-4.45-9.91-9.91-9.91zm0 18.17h-.01c-1.5 0-2.96-.4-4.22-1.13l-.3-.18l-3.12.82l.83-3.04l-.2-.31c-.82-1.28-1.25-2.76-1.25-4.32c0-4.54 3.69-8.23 8.24-8.23c4.54 0 8.23 3.69 8.23 8.23c0 4.54-3.69 8.23-8.23 8.23zm4.49-5.83c-.25-.12-1.47-.72-1.7-.8c-.22-.08-.38-.12-.54.12s-.64.8-.79.96c-.14.16-.29.18-.54.06c-.25-.12-1.05-.39-2-1.23c-.74-.66-1.23-1.48-1.38-1.72c-.14-.24-.01-.38.11-.5c.11-.11.24-.29.37-.43s.18-.24.27-.4c.09-.16.04-.3-.02-.42c-.06-.12-.54-1.3-.74-1.78s-.4-.41-.55-.41h-.48c-.16 0-.42.06-.64.3c-.22.24-.86.84-.86 2.04s.88 2.37 1 2.53s1.75 2.67 4.22 3.72c.59.25 1.05.4 1.41.51c.59.18 1.13.16 1.56.1c.48-.07 1.47-.6 1.67-1.18s.21-1.08.15-1.18c-.06-.1-.22-.16-.47-.28z"/></svg> }
    ];

    return (
        <div className="page updates-page">
            <div className="header"><h1>التحديثات القادمة</h1></div>
            <p className="updates-intro">نعمل باستمرار على تطوير التطبيق وإضافة ميزات جديدة لمساعدتك في رحلتك الدراسية. إليك لمحة عما هو قادم:</p>
            <div className="updates-list">
                {updates.map((update, index) => (
                    <div key={index} className="update-card">
                        <span className="material-icons update-icon">{update.icon}</span>
                        <h3>{update.title}</h3>
                        <p>{update.description}</p>
                    </div>
                ))}
            </div>

            <div className="teacher-registration-section">
                <h2>للمعلمين: احصل على حسابك</h2>
                <p>تواصلوا معنا مباشرة عبر واتساب للحصول على حساب معلم والاستفادة من الميزات المخصصة لكم.</p>
                <div className="teacher-registration-form">
                    <a 
                        href="https://wa.me/963983697920"
                        className="whatsapp-register-btn" 
                        target="_blank" 
                        rel="noopener noreferrer"
                    >
                        <svg viewBox="0 0 24 24"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91c0-5.46-4.45-9.91-9.91-9.91zm0 18.17h-.01c-1.5 0-2.96-.4-4.22-1.13l-.3-.18l-3.12.82l.83-3.04l-.2-.31c-.82-1.28-1.25-2.76-1.25-4.32c0-4.54 3.69-8.23 8.24-8.23c4.54 0 8.23 3.69 8.23 8.23c0 4.54-3.69 8.23-8.23 8.23zm4.49-5.83c-.25-.12-1.47-.72-1.7-.8c-.22-.08-.38-.12-.54.12s-.64.8-.79.96c-.14.16-.29.18-.54.06c-.25-.12-1.05-.39-2-1.23c-.74-.66-1.23-1.48-1.38-1.72c-.14-.24-.01-.38.11-.5c.11-.11.24-.29.37-.43s.18-.24.27-.4c.09-.16.04-.3-.02-.42c-.06-.12-.54-1.3-.74-1.78s-.4-.41-.55-.41h-.48c-.16 0-.42.06-.64.3c-.22.24-.86.84-.86 2.04s.88 2.37 1 2.53s1.75 2.67 4.22 3.72c.59.25 1.05.4 1.41.51c.59.18 1.13.16 1.56.1c.48-.07 1.47-.6 1.67-1.18s.21-1.08.15-1.18c-.06-.1-.22-.16-.47-.28z"/></svg>
                        <span>تواصل عبر واتساب</span>
                    </a>
                </div>
            </div>

            <div className="follow-us-section">
                <h2 className="follow-us-title">تابعونا</h2>
                <div className="social-links-container">
                    {socialLinks.map((link) => (
                        <a 
                            key={link.name} 
                            href={link.href} 
                            className={`social-link social-link--${link.name.toLowerCase()}`}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            aria-label={`تابعنا على ${link.name}`}
                        >
                            {link.icon}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
};


// --- Render App ---
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);