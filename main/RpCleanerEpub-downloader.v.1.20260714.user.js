// ==UserScript==
// @name         RP 로그 클리너 EPUB 다운로더 (파일명 지정)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  RP 로그 클리너 EPUB 변환, 옵션 선택 및 파일명 자동 지정 기능
// @author       eun033
// @match        https://chyoyam-alt.github.io/rp-log-cleaner/
// @grant        none
// @updateURL    https://raw.githubusercontent.com/eun033/RpCleanerEpub/main/RpCleanerEpub-downloader.v.1.20260714.user.js
// @downloadURL  https://raw.githubusercontent.com/eun033/RpCleanerEpub/main/RpCleanerEpub-downloader.v.1.20260714.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// ==/UserScript==

(function() {
    'use strict';

    // 기본 파일명 추출 함수 (div#fileList의 첫 번째 항목에서 - 뒤의 이름)
    function getDefaultFileName() {
        const fileList = document.querySelector('div#fileList');
        if (fileList && fileList.children.length > 0) {
            // 첫 번째 파일 요소의 텍스트 가져오기 (예: "01 - 내로그.txt" 또는 "내로그.txt")
            const firstFileText = fileList.children[0].innerText || fileList.children[0].textContent;
            
            if (firstFileText.includes('-')) {
                // 하이픈(-)이 있으면 뒤쪽 텍스트를 가져와서 확장자(.txt 등) 제거 및 공백 정리
                const afterHyphen = firstFileText.split('-')[1].trim();
                return afterHyphen.replace(/\.[^/.]+$/, ""); 
            } else {
                // 하이픈이 없으면 그냥 확장자만 제거
                return firstFileText.trim().replace(/\.[^/.]+$/, "");
            }
        }
        return "clean_log"; // 파일 목록이 없을 때 기본값
    }

    // 모달창 생성
    function createModal() {
        // 기존 모달이 있다면 제거 (매번 새로 켤 때 파일명 갱신을 위해)
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
                <input type="checkbox" id="trans-option" checked> 다국어 대화에서 한글만 남기기
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
            
            if (!fileName) fileName = "clean_log"; // 빈칸으로 두면 기본값 적용
            
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
        zip.file("mimetype", "application/epub+zip");
        const htmlContent = `<html><body><pre style="white-space: pre-wrap;">${text}</pre></body></html>`;
        zip.file("OEBPS/content.html", htmlContent);
        
        const blob = await zip.generateAsync({
            type: "blob",
            mimeType: "application/epub+zip"
        });
        saveAs(blob, `${fileName}.epub`);
    }

    // 버튼 생성
    const btn = document.createElement('button');
    btn.innerHTML = "EPUB";
    btn.style.cssText = "position:fixed; bottom:30px; right:30px; width:60px; height:60px; border-radius:50%; background:#ff6b6b; color:white; border:none; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:9999; font-weight:bold; font-size:12px;";
    
    btn.onclick = () => {
        createModal(); // 열 때마다 파일명을 새로 계산해서 모달을 생성
        document.getElementById('epub-modal').style.display = 'block';
    };
    
    document.body.appendChild(btn);
})();
