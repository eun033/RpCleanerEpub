// ==UserScript==
// @name         RP 로그 클리너 EPUB 다운로더
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  EPUB 변환 및 다운로드 기능
// @author       eun033
// @match        https://chyoyam-alt.github.io/rp-log-cleaner/
// @grant        none
// @updateURL    https://raw.githubusercontent.com/eun033/RpCleanerEpub/refs/heads/main/main/RpCleanerEpub-downloader.v.1.20260714.user.js
// @downloadURL  https://raw.githubusercontent.com/eun033/RpCleanerEpub/refs/heads/main/main/RpCleanerEpub-downloader.v.1.20260714.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// ==/UserScript==

// 1.0: 리디북스 뷰어 표준 규격 EPUB / 외국어캐 관련 체크 / 파일명 첫번째 것 불러오기

(function() {
    'use strict';

    // 현재 날짜시간을 yyyyMMddHHmmss 형식으로 반환하는 함수
    function getFormattedTimestamp() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
    }

    // 파일명 추출 함수 (제안해주신 <br> 태그 검증 로직 반영)
    function getDefaultFileName() {
        const fileList = document.querySelector('div#fileList');
        let targetText = "";

        if (fileList) {
            // 1. <br> 태그 존재 여부에 따라 분기 처리
            if (fileList.innerHTML.includes('<br>')) {
                // <br> 기준으로 쪼개어 첫 번째 파일명 추출
                const parts = fileList.innerHTML.split(/<br\s*\/?>/i);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = parts[0];
                targetText = tempDiv.textContent || tempDiv.innerText;
            } else {
                // <br>이 없으면 전체 innerHTML을 파싱
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = fileList.innerHTML;
                targetText = tempDiv.textContent || tempDiv.innerText;
            }

            // 앞뒤 공백 및 맨 앞의 대시 기호 정리
            targetText = targetText.trim().replace(/^[—\-\s]+/, "");
        }

        // 2. 파일명이 추출되었다면 확장자 제거 후 날짜 붙이기, 실패 시 기본값 "clean_log_날짜"
        const baseName = targetText ? targetText.replace(/\.[^/.]+$/, "") : "clean_log";
        return `${baseName}_${getFormattedTimestamp()}`;
    }

    function createModal() {
        const oldModal = document.getElementById('epub-modal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'epub-modal';
        modal.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:white; padding:20px; border-radius:10px; box-shadow:0 5px 15px rgba(0,0,0,0.3); z-index:10000; color:#333; font-family:sans-serif; min-width:280px;";
        
        const defaultName = getDefaultFileName();

        modal.innerHTML = `
            <h3 style="margin-top:0; margin-bottom:15px; font-size:16px;">EPUB 변환 설정</h3>
            <div style="margin-bottom:15px;">
                <label style="display:block; margin-bottom:5px; font-size:13px; font-weight:bold;">파일 이름</label>
                <input type="text" id="epub-filename" value="${defaultName}" style="width:100%; padding:6px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;">
            </div>
            <div style="margin-bottom:20px;">
                <label style="display:block; margin-bottom:20px; cursor:pointer; font-size:13px;">
                    <input type="checkbox" id="trans-option"> 다국어 대화에서 한글만 남기기 EX) "Hello" (안녕) -> "안녕"
                </label>
                <label style="display:block; cursor:pointer; font-size:13px;">
                    <input type="checkbox" id="user-option"> [User] 태그 및 줄바꿈 제거
                </label>
            </div>
            <div style="text-align:right;">
                <button id="btn-cancel" style="margin-right:10px; background:#eee; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">취소</button>
                <button id="btn-confirm" style="background:#ff6b6b; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">변환 시작</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-cancel').onclick = () => modal.style.display = 'none';
        document.getElementById('btn-confirm').onclick = () => {
            const isMultiLang = document.getElementById('trans-option').checked;
            const isUserTag = document.getElementById('user-option').checked;
            let fileName = document.getElementById('epub-filename').value.trim();
            if (!fileName) fileName = `clean_log_${getFormattedTimestamp()}`;
            
            generateEpub(isMultiLang, isUserTag, fileName);
            modal.style.display = 'none';
        };
    }

    async function generateEpub(isMultiLang, isUserTag, fileName) {
        const textArea = document.querySelector('#cleanOutput');
        let text = textArea ? textArea.value : "";

        if (!text.trim()) {
            alert("변환할 클린 결과가 없습니다!");
            return;
        }

        // 1. [User] 태그 및 줄바꿈 제거
        if (isUserTag) {
            text = text.replace(/\[User\]\s*/g, "");
        }

        // 2. 다국어 대화 한글만 남기기 로직 변경
        if (isMultiLang) {
            // (.+｜) : 캐릭터 이름과 구분자까지 캡처
            // "[^"]*" : 따옴표 안의 영어 원문
            // \(([^)]+)\) : 괄호 안의 한글 추출
            // $1 : 캐릭터 이름, $2 : 한글 대사
            text = text.replace(/(.+｜)"[^"]*"\s*\(([^)]+)\)/g, '$1"$2"\n');
        }

        const zip = new JSZip();

        // 1. mimetype 파일 설정 (공백/줄바꿈 없이 엄격하게 들어가야 함)
        zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

        // 2. META-INF/container.xml 생성 (리디가 본문 위치를 찾을 수 있게 해줌)
        const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
        zip.file("META-INF/container.xml", containerXml);

        // 3. OEBPS/content.opf 생성 (책의 제목, ID, 파일 목록 등 메타데이터 정의)
        const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>${fileName}</dc:title>
        <dc:creator>RP Cleaner</dc:creator>
        <dc:identifier id="bookid">urn:uuid:${Math.random().toString(36).substring(2, 11)}</dc:identifier>
        <dc:language>ko</dc:language>
    </metadata>
    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="content" href="content.html" media-type="application/xhtml+xml"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="content"/>
    </spine>
</package>`;
        zip.file("OEBPS/content.opf", contentOpf);

        // 4. OEBPS/toc.ncx 생성 (목차 파일)
        const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx-2005-1.dtd" version="2.005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:12345"/>
        <meta name="dtb:depth" content="1"/>
    </head>
    <docTitle><text>${fileName}</text></docTitle>
    <navMap>
        <navPoint id="navPoint-1" playOrder="1">
            <navLabel><text>본문</text></navLabel>
            <content src="content.html"/>
        </navPoint>
    </navMap>
</ncx>`;
        zip.file("OEBPS/toc.ncx", tocNcx);

        // 5. OEBPS/content.html 본문 생성
        const htmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ko">
<head>
    <title>${fileName}</title>
    <meta http-equiv="Content-Type" content="application/xhtml+xml; charset=utf-8" />
</head>
<body>
    <pre style="white-space: pre-wrap; font-family: sans-serif; line-height: 1.6;">${text}</pre>
</body>
</html>`;
        zip.file("OEBPS/content.html", htmlContent);
        
        // 6. 압축 및 다운로드
        const blob = await zip.generateAsync({
            type: "blob",
            mimeType: "application/epub+zip"
        });
        saveAs(blob, `${fileName}.epub`);
    }

    // 버튼 생성 및 이벤트 바인딩
    const btn = document.createElement('button');
    btn.innerHTML = "EPUB";
    btn.style.cssText = "position:fixed; bottom:30px; right:30px; width:60px; height:60px; border-radius:50%; background:#ff6b6b; color:white; border:none; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:9999; font-weight:bold; font-size:12px;";
    
    btn.onclick = () => {
        createModal();
        document.getElementById('epub-modal').style.display = 'block';
    };
    
    document.body.appendChild(btn);
})();
