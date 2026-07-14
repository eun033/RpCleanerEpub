// ==UserScript==
// @name         RP 로그 클리너 EPUB 다운로더
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  EPUB 변환 및 다운로드 기능
// @author       eun033
// @match        https://chyoyam-alt.github.io/rp-log-cleaner/
// @grant        none
// @updateURL    https://raw.githubusercontent.com/eun033/RpCleanerEpub/main/RpCleanerEpub.user.js
// @downloadURL  https://raw.githubusercontent.com/eun033/RpCleanerEpub/main/RpCleanerEpub.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// ==/UserScript==

// 1.0: 리디북스 뷰어 표준 규격 EPUB / 외국어캐 관련 체크 / 파일명 첫번째 것 불러오기

(function() {
    'use strict';

    function getDefaultFileName() {
        const fileList = document.querySelector('div#fileList');
        if (fileList && fileList.children.length > 0) {
            const firstFileText = fileList.children[0].innerText || fileList.children[0].textContent;
            if (firstFileText.includes('— ')) {
                const afterHyphen = firstFileText.split('-')[1].trim();
                return afterHyphen.replace(/\.[^/.]+$/, ""); 
            } else {
                return firstFileText.trim().replace(/\.[^/.]+$/, "");
            }
        }
        return "clean_log";
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
            <label style="display:block; margin-bottom:20px; cursor:pointer; font-size:13px;">
                <input type="checkbox" id="trans-option" checked> 다국어 대화에서 한글만 남기기 EX) "Hello" (안녕) -> "안녕"
            </label>
            <div style="text-align:right;">
                <button id="btn-cancel" style="margin-right:10px; background:#eee; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">취소</button>
                <button id="btn-confirm" style="background:#ff6b6b; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">변환 시작</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-cancel').onclick = () => modal.style.display = 'none';
        document.getElementById('btn-confirm').onclick = () => {
            const isOptionChecked = document.getElementById('trans-option').checked;
            let fileName = document.getElementById('epub-filename').value.trim();
            if (!fileName) fileName = "clean_log";
            
            generateEpub(isOptionChecked, fileName);
            modal.style.display = 'none';
        };
    }

    async function generateEpub(isClean, fileName) {
        const textArea = document.querySelector('#cleanOutput');
        let text = textArea ? textArea.value : "";

        if (!text.trim()) {
            alert("변환할 클린 결과가 없습니다!");
            return;
        }

        if (isClean) {
            text = text.replace(/"[a-zA-Z\s]+"\s*\(([^)]+)\)/g, "($1)");
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
