// ==UserScript==
// @name         RP 로그 클리너 EPUB 다운로더
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  RP 로그 클리너 EPUB 변환 및 다운로드 기능
// @author       eun033
// @match        https://chyoyam-alt.github.io/rp-log-cleaner/
// @updateURL    https://raw.githubusercontent.com/eun033/RpCleanerEpub/main/RpCleanerEpub-downloader.v.1.20260714.js
// @downloadURL  https://raw.githubusercontent.com/eun033/RpCleanerEpub/main/RpCleanerEpub-downloader.v.1.20260714.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// ==/UserScript==

(function() {
    'use strict';

    // 모달창 생성
    function createModal() {
        const modal = document.createElement('div');
        modal.id = 'epub-modal';
        modal.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:white; padding:20px; border-radius:10px; box-shadow:0 5px 15px rgba(0,0,0,0.3); z-index:10000; display:none;";
        
        modal.innerHTML = `
            <h3 style="margin-top:0;">EPUB 변환 옵션</h3>
            <label style="display:block; margin-bottom:15px; cursor:pointer;">
                <input type="checkbox" id="trans-option" checked> 다국어 대화에서 한글만 남기기
            </label>
            <div style="text-align:right;">
                <button id="btn-cancel" style="margin-right:10px;">취소</button>
                <button id="btn-confirm" style="background:#ff6b6b; color:white; border:none; padding:5px 10px; border-radius:5px;">변환 시작</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-cancel').onclick = () => modal.style.display = 'none';
        document.getElementById('btn-confirm').onclick = () => {
            const isOptionChecked = document.getElementById('trans-option').checked;
            generateEpub(isOptionChecked);
            modal.style.display = 'none';
        };
    }

    async function generateEpub(isClean) {
        const textArea = document.querySelector('#cleanOutput');
        let text = textArea ? textArea.value : "";

        if (!text.trim()) {
            alert("변환할 클린 결과가 없습니다!");
            return;
        }

        // 옵션 선택 시 정규식 적용
        if (isClean) {
            text = text.replace(/"[a-zA-Z\s]+"\s*\(([^)]+)\)/g, "($1)");
        }

        const zip = new JSZip();
        zip.file("mimetype", "application/epub+zip");
        const htmlContent = `<html><body><pre style="white-space: pre-wrap;">${text}</pre></body></html>`;
        zip.file("OEBPS/content.html", htmlContent);
        
        const blob = await zip.generateAsync({type: "blob"});
        saveAs(blob, "clean_log.epub");
    }

    // 버튼 생성
    const btn = document.createElement('button');
    btn.innerHTML = "EPUB";
    btn.style.cssText = "position:fixed; bottom:30px; right:30px; width:60px; height:60px; border-radius:50%; background:#ff6b6b; color:white; border:none; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:9999; font-weight:bold;";
    btn.onclick = () => document.getElementById('epub-modal').style.display = 'block';
    document.body.appendChild(btn);

    createModal();
})();
