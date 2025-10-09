import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat } from '@google/genai';

// Fix: Add a global declaration for `window.html2canvas` to resolve TypeScript errors at lines 451 and 466.
declare global {
  interface Window {
    html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
  }
}

// --- Main App Component ---
const App = () => {
  const [activePage, setActivePage] = useState('chat');
  const [showMotivationalModal, setShowMotivationalModal] = useState(false);
  const [motivationalMessage, setMotivationalMessage] = useState('');

  useEffect(() => {
    const visitCountStr = localStorage.getItem('appVisitCount') || '0';
    let visitCount = parseInt(visitCountStr, 10) + 1;

    if (visitCount === 1 || visitCount % 15 === 0) {
      setShowMotivationalModal(true);
      const fetchMotivationalMessage = async () => {
        if (!ai) {
          setMotivationalMessage("قوتك لا تكمن في غياب الصعوبات، بل في قدرتك على تجاوزها. استمر.");
          return;
        }
        try {
          const prompt = "اكتب رسالة تحفيزية قصيرة وملهمة، لا تتجاوز ثلاث جمل، لطالب سوري يدرس في ظل الظروف الصعبة. يجب أن تكون الرسالة مشجعة وتركز على قوة الإرادة وأهمية العلم لمستقبل سوريا.";
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
          });
          setMotivationalMessage(response.text);
        } catch (error) {
          console.error("Failed to fetch motivational message:", error);
          setMotivationalMessage("كل صفحة تقرأها اليوم هي خطوة تبني بها غداً مشرقاً لك ولوطنك.");
        }
      };
      fetchMotivationalMessage();
    }

    localStorage.setItem('appVisitCount', visitCount.toString());
  }, []);

  const renderPage = () => {
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


// --- API Setup ---
let ai;
try {
    ai = new GoogleGenAI({ apiKey: "AIzaSyBRfDUSaRSjrJ2HQokh4w8TkCK3JrVf4Po" });
} catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
}

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


// --- Chat Page Component ---
const ChatPage = () => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (ai) {
            const newChat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: 'You are a helpful assistant for a student. Your responses should be encouraging and clear. Respond in Arabic.',
                },
            });
            setChat(newChat);
        }

        const timer = setTimeout(() => {
            setShowWelcomeModal(true);
        }, 3000);

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

    const handleSendMessage = async () => {
        if ((!inputValue.trim() && !imageFile) || !chat || isLoading) return;

        const userMessage: { role: string; text: string; image: string | null; } = { role: 'user', text: inputValue, image: imagePreview };
        setMessages(prev => [...prev, userMessage]);

        const currentInputValue = inputValue;
        const currentImageFile = imageFile;

        setInputValue('');
        setImageFile(null);
        setImagePreview(null);
        setIsLoading(true);

        try {
            const messageParts: any[] = [];
            if (currentInputValue.trim()) {
                messageParts.push({ text: currentInputValue.trim() });
            }
            if (currentImageFile) {
                const base64Data = await fileToBase64(currentImageFile);
                messageParts.push({
                    inlineData: {
                        mimeType: currentImageFile.type,
                        data: base64Data,
                    },
                });
            }
            
            const response = await chat.sendMessage({ message: messageParts });
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
    
    if(!ai) {
        return <div className="page"><div className="header"><h1>الدردشة</h1></div><div className="error-message">لم يتم تهيئة واجهة برمجة التطبيقات. يرجى التحقق من مفتاح API الخاص بك.</div></div>;
    }

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
                {messages.map((msg, index) => (
                    <div key={index} className={`message-bubble ${msg.role}`}>
                        {msg.image && <img src={msg.image} alt="ملحق المستخدم" className="chat-image" />}
                        {msg.text && <p className="message-text">{msg.text}</p>}
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
                        onClick={handleSendMessage} 
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
                { name: 'الصف الأول', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc', url: 'https://drive.google.com/uc?export=download&id=12unENA6S9VJQeYkbzkxRARZUvVkd8jKO' } ] },
                { name: 'الصف الثاني', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' } ] },
                { name: 'الصف الثالث', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' } ] },
                { name: 'الصف الرابع', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'الصف الخامس', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' }, { name: 'الاجتماعيات', icon: 'public' } ] },
                { name: 'الصف السادس', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' }, { name: 'الاجتماعيات', icon: 'public' } ] },
            ]
        },
        {
            name: 'المرحلة الإعدادية',
            icon: 'history_edu',
            grades: [
                { name: 'الصف السابع', subjects: [ { name: 'الجبر', icon: 'calculate' }, { name: 'الهندسة', icon: 'architecture' }, { name: 'العلوم', icon: 'science' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'الصف الثامن', subjects: [ { name: 'الجبر', icon: 'calculate' }, { name: 'الهندسة', icon: 'architecture' }, { name: 'العلوم', icon: 'science' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'الصف التاسع', subjects: [ { name: 'الجبر', icon: 'calculate' }, { name: 'الهندسة', icon: 'architecture' }, { name: 'الفيزياء والكيمياء', icon: 'science' }, { name: 'علم الأحياء', icon: 'biotech' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
            ]
        },
        {
            name: 'المرحلة الثانوية',
            icon: 'school',
            grades: [
                { name: 'العاشر العلمي', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'الفيزياء', icon: 'bolt' }, { name: 'الكيمياء', icon: 'science' }, { name: 'علم الأحياء', icon: 'biotech' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'العاشر الأدبي', subjects: [ { name: 'الفلسفة', icon: 'psychology' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'الحادي عشر العلمي', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'الفيزياء', icon: 'bolt' }, { name: 'الكيمياء', icon: 'science' }, { name: 'علم الأحياء', icon: 'biotech' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'الحادي عشر الأدبي', subjects: [ { name: 'الفلسفة', icon: 'psychology' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'البكالوريا العلمي', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'الفيزياء', icon: 'bolt' }, { name: 'الكيمياء', icon: 'science' }, { name: 'العلوم', icon: 'biotech' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'البكالوريا الأدبي', subjects: [ { name: 'الفلسفة', icon: 'psychology' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
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
        if (files.length === 0 || !ai) return;
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

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: messageParts },
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
        if (!element || typeof window.html2canvas === 'undefined') {
            alert('لا يمكن تحميل الخريطة الذهنية.');
            return;
        }

        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.transform = '';
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.width = `${element.offsetWidth}px`;
        clone.style.height = `${element.offsetHeight}px`;
        document.body.appendChild(clone);

        try {
            const canvas = await window.html2canvas(clone, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#F7F5F2'
            });
            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.download = 'mind-map.png';
            link.href = image;
            link.click();
        } catch (error) {
            console.error('Error downloading mind map:', error);
            alert('حدث خطأ أثناء إنشاء الصورة.');
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


    if (!ai) {
        return <div className="page"><div className="header"><h1>تلخيص</h1></div><div className="error-message">لم يتم تهيئة واجهة برمجة التطبيقات. يرجى التحقق من مفتاح API الخاص بك.</div></div>;
    }

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
        if ((!topic.trim() && files.length === 0) || !ai) return;
        setIsLoading(true);
        setQuestions([]);
        setError('');

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

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: messageParts },
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
    
    if (!ai) {
        return <div className="page"><div className="header"><h1>أسئلة امتحانية</h1></div><div className="error-message">لم يتم تهيئة واجهة برمجة التطبيقات. يرجى التحقق من مفتاح API الخاص بك.</div></div>;
    }

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
                                        <li key={i} className={option === q.answer ? 'correct' : ''}>
                                            {option}
                                        </li>
                                    ))}
                                </ul>
                            )}
                             {q.type !== 'Multiple Choice' && (
                               <p className="answer-text"><strong>الإجابة:</strong> {q.answer}</p>
                             )}
                        </div>
                    ))}
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
        if (!ai) {
            setError('لم يتم تهيئة واجهة برمجة التطبيقات.');
            return;
        }
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
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: promptText }] },
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
        { icon: 'auto_awesome', title: 'أنظمة ذكية للمساعدة', description: 'أدوات ذكية لتحليل تقدمك الدراسي وتقديم توصيات وخطط مخصصة لك.' }
    ];

    const socialLinks = [
        { name: 'Facebook', href: '#', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.04C6.5 2.04 2 6.53 2 12.06c0 5.52 4.5 10.02 10 10.02s10-4.5 10-10.02C22 6.53 17.5 2.04 12 2.04zM13.5 18h-3v-7.5H9v-3h1.5V6.45c0-1.2.6-2.45 2.5-2.45H15v3h-1.5c-.3 0-.5.2-.5.5V10.5h2l-.5 3h-1.5V18z"/></svg> },
        { name: 'Telegram', href: '#', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23l7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3L3.64 12c-.88-.25-.89-.86.2-1.08l16.2-6.16c.76-.29 1.44.14 1.22.91L20.1 18.03c-.22.8-1.02 1-1.5.64l-4.1-3.29l-1.93 1.83c-.22.23-.42.42-.81.42z"/></svg> },
        { name: 'WhatsApp', href: '#', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91c0-5.46-4.45-9.91-9.91-9.91zm0 18.17h-.01c-1.5 0-2.96-.4-4.22-1.13l-.3-.18l-3.12.82l.83-3.04l-.2-.31c-.82-1.28-1.25-2.76-1.25-4.32c0-4.54 3.69-8.23 8.24-8.23c4.54 0 8.23 3.69 8.23 8.23c0 4.54-3.69 8.23-8.23 8.23zm4.49-5.83c-.25-.12-1.47-.72-1.7-.8c-.22-.08-.38-.12-.54.12s-.64.8-.79.96c-.14.16-.29.18-.54.06c-.25-.12-1.05-.39-2-1.23c-.74-.66-1.23-1.48-1.38-1.72c-.14-.24-.01-.38.11-.5c.11-.11.24-.29.37-.43s.18-.24.27-.4c.09-.16.04-.3-.02-.42c-.06-.12-.54-1.3-.74-1.78s-.4-.41-.55-.41h-.48c-.16 0-.42.06-.64.3c-.22.24-.86.84-.86 2.04s.88 2.37 1 2.53s1.75 2.67 4.22 3.72c.59.25 1.05.4 1.41.51c.59.18 1.13.16 1.56.1c.48-.07 1.47-.6 1.67-1.18s.21-1.08.15-1.18c-.06-.1-.22-.16-.47-.28z"/></svg> }
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
                        href="https://wa.me/963987654321"
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