//! A build script to compile d3d11 shaders for SC:R
//! Could be extended to also build Forge's 1.16.1 shaders at some point =)

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::ptr::{null, null_mut};

use anyhow::{Context, Error};

use winapi::um::d3dcompiler::*;
use winapi::um::d3dcommon::*;
use winapi::um::winnt::HRESULT;
use winapi::shared::winerror::{E_FAIL, S_OK};

static SOURCES: &[(&str, &str, &[(&str, &str)])] = &[
    ("mask", "mask.hlsl", &[]),
];

fn main() {
    let out_path = std::env::var("OUT_DIR").unwrap();
    let out_path = Path::new(&out_path);
    assert!(out_path.exists());
    let shader_dir = Path::new("src/bw_scr/shaders");
    for &(out_name, source, defines) in SOURCES.iter() {
        let source_path = shader_dir.join(source);
        println!("cargo:rerun-if-changed={}", source_path.to_str().unwrap());
        let bin_path = out_path.join(&format!("{}.sm5.bin", out_name));
        let asm_path = out_path.join(&format!("{}.sm5.asm", out_name));
        compile_prism_shader(
            &source_path,
            &bin_path,
            &asm_path,
            defines,
            shader_dir,
            ShaderModel::Sm5
        ).unwrap_or_else(|e| panic!("Failed to compile {}: {:?}", out_name, e));

        let bin_path = out_path.join(&format!("{}.sm4.bin", out_name));
        let asm_path = out_path.join(&format!("{}.sm4.asm", out_name));
        compile_prism_shader(
            &source_path,
            &bin_path,
            &asm_path,
            defines,
            shader_dir,
            ShaderModel::Sm4,
        ).unwrap_or_else(|e| panic!("Failed to compile {}: {:?}", out_name, e));
    }
}

fn compile_prism_shader(
    source_path: &Path,
    out_path: &Path,
    disasm_path: &Path,
    defines: &[(&str, &str)],
    include_root: &Path,
    model: ShaderModel,
) -> Result<(), Error> {
    let text_bytes = fs::read(source_path)
        .with_context(|| format!("Failed to read {}", source_path.display()))?;
    let shader_bytes = compile(&text_bytes, defines, include_root, model)?;
    let wrapped = wrap_prism_shader(&shader_bytes);
    fs::write(&out_path, &wrapped)
        .with_context(|| format!("Failed to write {}", out_path.display()))?;
    disasm_shader(&shader_bytes, disasm_path)
        .context("Failed to disassemble the result")?;
    Ok(())
}

/// Output disassembly if needed for debugging.
/// Not necessary for actually building.
fn disasm_shader(shader_bytes: &[u8], out_path: &Path) -> Result<(), Error> {
    let disasm = disassemble(shader_bytes)?;
    fs::write(&out_path, &disasm)
        .with_context(|| format!("Failed to write {}", out_path.display()))?;
    Ok(())
}

enum ShaderModel {
    Sm4,
    Sm5,
}

fn wrap_prism_shader(bytes: &[u8]) -> Vec<u8> {
    let mut out = vec![0u8; 0x38];
    out[0] = 0x3;
    out[0x10] = 0x3;
    out[0x20] = 0x3;
    out[0x28] = 0x1;
    (&mut out[0x30..0x34]).copy_from_slice(&(bytes.len() as u32).to_le_bytes());
    out[0x34] = 0x4;
    out.extend_from_slice(bytes);
    out
}

fn compile(
    bytes: &[u8],
    in_defines: &[(&str, &str)],
    shader_dir: &Path,
    model: ShaderModel,
) -> io::Result<Vec<u8>> {
    unsafe {
        let mut defines = vec![];
        // Hold define strings for the compilation
        let mut strings = vec![];
        for &(name, val) in in_defines {
            let name = format!("{}\0", name);
            let val = format!("{}\0", val);
            defines.push(D3D_SHADER_MACRO {
                Name: name.as_ptr() as *const i8,
                Definition: val.as_ptr() as *const i8,
            });
            strings.push(name);
            strings.push(val);
        }
        defines.push(D3D_SHADER_MACRO {
            Name: null(),
            Definition: null(),
        });
        let mut code = null_mut();
        let mut errors = null_mut();
        let include = IncludeHandler::new(shader_dir.into());
        let model_string = match model {
            ShaderModel::Sm4 => "ps_4_0\0".as_ptr() as *const i8,
            ShaderModel::Sm5 => "ps_5_0\0".as_ptr() as *const i8,
        };
        let error = D3DCompile2(
            bytes.as_ptr() as *const _,
            bytes.len(),
            null(),
            defines.as_ptr(),
            include.0 as *mut ID3DInclude,
            b"main\0".as_ptr() as *const i8,
            model_string,
            D3DCOMPILE_OPTIMIZATION_LEVEL3 | D3DCOMPILE_WARNINGS_ARE_ERRORS,
            0,
            0,
            null(),
            0,
            &mut code,
            &mut errors,
        );
        scopeguard::defer! {
            if !code.is_null() {
                (*code).Release();
            }
            if !errors.is_null() {
                (*errors).Release();
            }
        }
        if error != 0 {
            if !errors.is_null() {
                let errors = blob_to_bytes(errors);
                println!("ERRORS:\n{}", String::from_utf8_lossy(&errors));
            }
            return Err(io::Error::from_raw_os_error(error));
        }
        Ok(blob_to_bytes(code))
    }
}

fn disassemble(bytes: &[u8]) -> io::Result<Vec<u8>> {
    unsafe {
        let mut blob = std::ptr::null_mut();
        let error = D3DDisassemble(
            bytes.as_ptr() as *const _,
            bytes.len(),
            0,
            b"\0".as_ptr() as *const _,
            &mut blob,
        );
        if error != 0 {
            return Err(io::Error::from_raw_os_error(error).into());
        }
        scopeguard::defer! {
            (*blob).Release();
        }
        Ok(blob_to_bytes(blob))
    }
}

unsafe fn blob_to_bytes(blob: *mut ID3D10Blob) -> Vec<u8> {
    let slice = std::slice::from_raw_parts(
        (*blob).GetBufferPointer() as *const u8,
        (*blob).GetBufferSize(),
    );
    slice.into()
}

static INCLUDE_VTABLE: ID3DIncludeVtbl = ID3DIncludeVtbl {
    Open: IncludeHandler::open,
    Close: IncludeHandler::close,
};

#[repr(C)]
struct IncludeHandler {
    interface: ID3DInclude,
    path: PathBuf,
    buffers: Vec<Vec<u8>>,
}

struct IncludeHandlerHandle(*mut IncludeHandler);

impl Drop for IncludeHandlerHandle {
    fn drop(&mut self) {
        unsafe { Box::from_raw(self.0); }
    }
}

/// Resolves shader includes to a filesystem file relative from the path passed to the
/// constructor.
impl IncludeHandler {
    fn new(path: PathBuf) -> IncludeHandlerHandle {
        let ptr = Box::into_raw(Box::new(IncludeHandler {
            interface: ID3DInclude {
                lpVtbl: &INCLUDE_VTABLE,
            },
            path,
            buffers: Vec::new(),
        }));
        IncludeHandlerHandle(ptr)
    }

    unsafe extern "system" fn open(
        s: *mut ID3DInclude,
        _include_type: D3D_INCLUDE_TYPE,
        filename: *const i8,
        _parent_data: *const winapi::ctypes::c_void,
        out_data: *mut *const winapi::ctypes::c_void,
        out_size: *mut u32,
    ) -> HRESULT {
        *out_data = null_mut();
        *out_size = 0;
        let s = s as *mut IncludeHandler;
        let filename_len = (0..).position(|i| *filename.add(i) == 0).unwrap();
        let filename = std::slice::from_raw_parts(filename as *const u8, filename_len);
        let filename = match std::str::from_utf8(filename) {
            Ok(o) => o,
            Err(_) => return E_FAIL,
        };
        let path = (*s).path.join(filename);
        println!("cargo:rerun-if-changed={}", path.to_str().unwrap());
        let result = match fs::read(&path) {
            Ok(o) => o,
            Err(e) => {
                println!("Reading include {} failed: {:?}", path.display(), e);
                return E_FAIL;
            }
        };
        let ptr = result.as_ptr();
        let len = result.len();
        (*s).buffers.push(result);
        *out_data = ptr as *const _;
        *out_size = len as u32;
        S_OK
    }

    unsafe extern "system" fn close(
        s: *mut ID3DInclude,
        data: *const winapi::ctypes::c_void,
    ) -> HRESULT {
        let s = s as *mut IncludeHandler;
        let pos = match (*s).buffers.iter().position(|x| x.as_ptr() == data as *const u8) {
            Some(s) => s,
            None => return E_FAIL,
        };
        (*s).buffers.swap_remove(pos);
        S_OK
    }
}
